/**
 * Canonical order-status pipeline.
 *
 * This is DATA, not display copy. Per CLAUDE.md §1 ("Field/stage labels are data")
 * and §3 (naming authority), components and DTOs must derive labels and progress
 * from this single source and never hardcode stage strings. The pipeline maps 1:1
 * to `Opportunity.StageName` — see docs/ARCHITECTURE.md §2.3 for the mapping table.
 */
export const ORDER_STAGES = [
  "To Verify Payment",
  "Pending Balance",
  "Initial Contact",
  "Work Started",
  "Waiting to Ship",
  "Shipped",
  "Delivered",
  "Complete",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

/**
 * Portal stage → Salesforce `Opportunity.StageName` API value.
 * (docs/ARCHITECTURE.md §2.3). Kept here so no adapter hardcodes SF picklist names.
 */
export const ORDER_STAGE_TO_SF_STAGE: Readonly<Record<OrderStage, string>> = {
  "To Verify Payment": "To_Verify_Payment",
  "Pending Balance": "Pending_Balance",
  "Initial Contact": "Initial_Contact",
  "Work Started": "Work_Started",
  "Waiting to Ship": "Waiting_To_Ship",
  Shipped: "Shipped",
  Delivered: "Delivered",
  Complete: "Closed_Won",
};

/**
 * Zero-based position of a stage in the pipeline. Pure derivation over the
 * canonical data above (used e.g. to render a progress bar) — no business rules.
 */
export function orderStageIndex(stage: OrderStage): number {
  return ORDER_STAGES.indexOf(stage);
}
