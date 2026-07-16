/**
 * Canonical order pipeline — mirrors the REAL Salesforce `Online_Order__c.Status__c`
 * picklist discovered in the org (see docs/salesforce-data-model.md). `sfValue` is the
 * exact SF picklist string; `label` is the client-facing display. Progress is derived
 * from the order of the PROGRESSIVE stages below; terminal states sit outside the bar.
 * Labels are data here (CLAUDE.md §1) — components never hardcode stage strings.
 */
export interface OrderStageDef {
  readonly sfValue: string;
  readonly label: string;
}

export const ORDER_PIPELINE = [
  { sfValue: "To Verify Payment", label: "To Verify Payment" },
  { sfValue: "Pending Balance", label: "Pending Balance" },
  { sfValue: "Verified - Initial Contact", label: "Initial Contact" },
  { sfValue: "Verified - Work Started", label: "Work Started" },
  { sfValue: "Verified - Waiting to Ship", label: "Waiting to Ship" },
  { sfValue: "Verified - Shipped", label: "Shipped" },
  { sfValue: "Verified - Delivered", label: "Delivered" },
  { sfValue: "Verified - Complete", label: "Complete" },
] as const satisfies readonly OrderStageDef[];

/** Exact SF picklist value of a progressive pipeline stage. */
export type OrderStageSfValue = (typeof ORDER_PIPELINE)[number]["sfValue"];

/** Terminal states outside the progress bar (real SF picklist values). */
export const CANCELLED_STATES = [
  "Cancelled - Payment Failed",
  "Cancelled - Client Requested",
  "Cancelled - Duplicate Order",
  "Cancelled - Chargeback Received",
  "Cancelled - Refunded",
] as const;

export const ON_HOLD_STATES = [
  "ON HOLD - Client's Unresponsive",
  "ON HOLD - Other Reasons",
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

/** True when the status is a `Cancelled - *` or `ON HOLD - *` terminal state. */
export function isTerminalStatus(sfValue: string): boolean {
  return (
    (CANCELLED_STATES as readonly string[]).includes(sfValue) ||
    (ON_HOLD_STATES as readonly string[]).includes(sfValue)
  );
}
