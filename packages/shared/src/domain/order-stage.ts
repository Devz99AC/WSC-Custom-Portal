/**
 * Order pipeline for the WSC portal.
 *
 * ⚠️ **`Status__c` is filtered by record type.** The global field describe returns 16
 * values, but the **WSC** record type (`0120g000000QEpmAAG`) exposes only 12 — a WSC order
 * can never hold `Verified - Waiting to Ship`, `Verified - Shipped`, `Verified - Delivered`
 * or `ON HOLD - Waiting for Client`; those belong to other brands. Verified 2026-07-28 via
 * the UI API `picklist-values` endpoint. Read the record-type list, never the global
 * describe, or you end up modelling stages that cannot occur.
 *
 * Labels are data here (CLAUDE.md §1) — components never hardcode stage strings.
 */
import type { StaffRole } from "./entities.js";

export interface OrderStageDef {
  readonly sfValue: string;
  readonly label: string;
}

/** The progressive statuses a WSC order can actually hold, in order. */
export const ORDER_PIPELINE = [
  { sfValue: "To Verify Payment", label: "To Verify Payment" },
  { sfValue: "Pending Balance", label: "Pending Balance" },
  { sfValue: "Verified - Initial Contact", label: "Initial Contact" },
  { sfValue: "Verified - Work Started", label: "Work Started" },
  { sfValue: "Verified - Complete", label: "Complete" },
] as const satisfies readonly OrderStageDef[];

/** Exact SF picklist value of a progressive pipeline stage. */
export type OrderStageSfValue = (typeof ORDER_PIPELINE)[number]["sfValue"];

/**
 * What the CLIENT sees — the stakeholder's own wording, grouped over the real statuses
 * (display-only mapping; Salesforce is never written to, and its picklist is never
 * touched — 126 validation rules and Apex triggers depend on the current values).
 *
 * Decisions behind this shape (stakeholder, 2026-07-28):
 * - The original "Onboarding call" step was dropped as a duplicate: step 2 **is** the
 *   initial onboarding call.
 * - "Corp docs shipped" was dropped as a step. Shipping happens same-day inside
 *   `Verified - Work Started` (an order in at 10am ships by 2pm), so a separate step would
 *   sit permanently lit or permanently dark, telling the client nothing. This also removes
 *   the ordering conflict where credit-ready setup appeared to happen after shipping.
 */
export interface OrderDisplayStepDef {
  readonly key: string;
  readonly label: string;
  readonly sfValues: readonly string[];
}

export const ORDER_DISPLAY_STEPS = [
  {
    key: "unpaid",
    label: "Unpaid",
    sfValues: ["To Verify Payment", "Pending Balance"],
  },
  {
    key: "onboarding-call",
    label: "Initial Onboarding Call",
    sfValues: ["Verified - Initial Contact"],
  },
  {
    key: "work-started",
    label: "Work Started",
    sfValues: ["Verified - Work Started"],
  },
  {
    key: "complete",
    label: "Complete — ready for funding",
    sfValues: ["Verified - Complete"],
  },
] as const satisfies readonly OrderDisplayStepDef[];

/** Cancelled statuses. Deliberately NOT mapped onto the progress bar (stakeholder). */
export const CANCELLED_STATES = [
  "Cancelled - Payment Failed",
  "Cancelled - Client Requested",
  "Cancelled - Duplicate Order",
  "Cancelled - Chargeback Received",
  "Cancelled - Refunded",
] as const;

/**
 * On-hold statuses. The order is paused, not dead, so it keeps its progress bar with an
 * "on hold" badge over it.
 *
 * ⚠️ The API **value** carries an apostrophe (`Client's`) that the UI **label** does not
 * (`ON HOLD - Client Unresponsive`). Matching on what the picklist shows on screen would
 * silently never match — these are the values.
 */
export const ON_HOLD_STATES = [
  "ON HOLD - Client's Unresponsive",
  "ON HOLD - Other Reasons",
  // Not available on the WSC record type; kept so an order migrated from another brand
  // still reads as "on hold" rather than falling through to unknown.
  "ON HOLD - Waiting for Client",
] as const;

/** Any valid `Online_Order__c.Status__c` value (progressive or terminal). */
export type OrderStatusSf =
  | OrderStageSfValue
  | (typeof CANCELLED_STATES)[number]
  | (typeof ON_HOLD_STATES)[number];

/** Zero-based progress index of a progressive stage; -1 if terminal/unknown. */
export function orderStageIndex(sfValue: string): number {
  return ORDER_PIPELINE.findIndex((stage) => stage.sfValue === sfValue);
}

/** Client-facing label for any status value (falls back to the raw value). */
export function orderStageLabel(sfValue: string): string {
  return ORDER_PIPELINE.find((stage) => stage.sfValue === sfValue)?.label ?? sfValue;
}

export function isCancelledStatus(sfValue: string): boolean {
  return (CANCELLED_STATES as readonly string[]).includes(sfValue);
}

export function isOnHoldStatus(sfValue: string): boolean {
  return (ON_HOLD_STATES as readonly string[]).includes(sfValue);
}

/** True when the status is a `Cancelled - *` or `ON HOLD - *` state. */
export function isTerminalStatus(sfValue: string): boolean {
  return isCancelledStatus(sfValue) || isOnHoldStatus(sfValue);
}

/** True once payment has been verified (the `Verified - *` progressive stages) — the
 *  point at which staff ownership hands off from the Sales Advisor to the post-purchase
 *  Support Representative / Implementation Manager (stakeholder feedback, ACTION-PLAN F1). */
export function isPostPaymentStage(sfValue: string): boolean {
  return sfValue.startsWith("Verified");
}

/**
 * Which staff contacts a client should see, and in which order.
 *
 * Before the sale closes there is exactly one: the Sales Advisor. From the moment payment
 * is verified (`Verified - *`) the advisor steps out and **two** support contacts step in
 * — the Support Manager and Back-End Support. That hand-off is a real operational rule,
 * not a UI preference: the advisor's line closes once the sale is done, so continuing to
 * show them would send the client to someone who no longer handles their case.
 */
export function staffRolesForStatus(sfValue: string): readonly StaffRole[] {
  return isPostPaymentStage(sfValue) ? ["support-manager", "backend-support"] : ["advisor"];
}

/** Index of the display step a progressive status belongs to; -1 when it belongs to none. */
export function orderDisplayStepIndex(sfValue: string): number {
  return ORDER_DISPLAY_STEPS.findIndex((step) =>
    (step.sfValues as readonly string[]).includes(sfValue),
  );
}

export type OrderProgressState = "active" | "on-hold" | "cancelled";

export interface OrderProgressInput {
  statusSf: string;
  /** `Fully_Paid_Date__c` */
  fullyPaidAt: string | null;
  /** `TimeStamp_Verified_IC__c` */
  initialContactAt: string | null;
  /** `TimeStamp_Verified_Complete__c` */
  completedAt: string | null;
}

export interface OrderProgress {
  state: OrderProgressState;
  /** Index into ORDER_DISPLAY_STEPS of the furthest step reached; -1 when unknown. */
  stepIndex: number;
}

/**
 * Resolves where an order sits on the client-facing bar.
 *
 * The subtlety is on-hold orders: `Status__c` is a single field, so moving to
 * `ON HOLD - *` **overwrites** the stage the order was in — the bar would have nothing to
 * point at. Rather than guess, progress is re-derived from the stage timestamps
 * Salesforce already stamps, so an on-hold order shows exactly as much progress as can be
 * *proven*. `Verified - Work Started` has no timestamp of its own, so a paused order that
 * had reached it shows at the onboarding-call step — understating progress, which is the
 * safe direction to be wrong in.
 */
export function orderProgress(input: OrderProgressInput): OrderProgress {
  if (isCancelledStatus(input.statusSf)) {
    return { state: "cancelled", stepIndex: -1 };
  }

  if (isOnHoldStatus(input.statusSf)) {
    if (input.completedAt) {
      return { state: "on-hold", stepIndex: 3 };
    }
    if (input.initialContactAt) {
      return { state: "on-hold", stepIndex: 1 };
    }
    return { state: "on-hold", stepIndex: 0 };
  }

  return { state: "active", stepIndex: orderDisplayStepIndex(input.statusSf) };
}
