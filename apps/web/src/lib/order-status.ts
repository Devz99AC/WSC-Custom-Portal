import {
  ORDER_DISPLAY_STEPS,
  isCancelledStatus,
  isOnHoldStatus,
  orderDisplayStepIndex,
} from "@wsc/shared";

/**
 * The status text and colour a client sees, kept consistent with the progress bar: the
 * badge shows the same step name the bar highlights, never the raw Salesforce value.
 *
 * Cancelled orders collapse to a plain "Cancelled". The real picklist distinguishes
 * `Payment Failed`, `Duplicate Order`, `Chargeback Received`… — internal bookkeeping that
 * reads as accusatory to the person on the other side of the screen, and that the client
 * can't act on anyway. The advisor explains the why.
 */
export function orderStatusLabel(statusSf: string): string {
  if (isCancelledStatus(statusSf)) {
    return "Cancelled";
  }
  if (isOnHoldStatus(statusSf)) {
    return "On hold";
  }
  const index = orderDisplayStepIndex(statusSf);
  return ORDER_DISPLAY_STEPS[index]?.label ?? statusSf;
}

export function orderStatusBadgeClass(statusSf: string): string {
  if (isCancelledStatus(statusSf)) {
    return "b-bad";
  }
  if (isOnHoldStatus(statusSf)) {
    return "b-warn";
  }
  // "Unpaid" is the one active step that's on the client — flag it rather than showing a
  // reassuring green next to an outstanding balance.
  return orderDisplayStepIndex(statusSf) === 0 ? "b-warn" : "b-ok";
}
