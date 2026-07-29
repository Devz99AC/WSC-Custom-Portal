import { ORDER_DISPLAY_STEPS, orderProgress, type OrderProgressInput } from "@wsc/shared";

/**
 * Client-facing progress bar. Derived entirely from the shared display map and the order's
 * raw Salesforce status — no hardcoded stage strings (CLAUDE.md §1).
 *
 * A cancelled order gets **no bar at all**: a half-filled grey track reads as "still in
 * progress" and would mislead. It gets a plain statement instead.
 */
export function OrderTracker(props: OrderProgressInput & { onHoldReason: string | null }) {
  const { state, stepIndex } = orderProgress(props);

  if (state === "cancelled") {
    return (
      <p className="statusnote">
        This order was cancelled. Contact your advisor if you think that&apos;s a mistake.
      </p>
    );
  }

  return (
    <>
      {state === "on-hold" && (
        <div className="statusline">
          <span className="badge b-warn">On hold</span>
          <span className="statusnote">
            {props.onHoldReason ?? "Your advisor will get in touch about the next step."}
          </span>
        </div>
      )}
      <div className={`track${state === "on-hold" ? " paused" : ""}`}>
        {ORDER_DISPLAY_STEPS.map((step, index) => {
          const status = index < stepIndex ? "done" : index === stepIndex ? "cur" : "";
          return (
            <div key={step.key} className={`tstep ${status}`}>
              <div className="ring">{index < stepIndex ? "✓" : index + 1}</div>
              <div className="tl">{step.label}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
