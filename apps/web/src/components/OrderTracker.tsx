import { ORDER_PIPELINE, orderStageIndex } from "@wsc/shared";

interface OrderTrackerProps {
  statusSf: string;
}

/**
 * Progress bar derived from the canonical pipeline in @wsc/shared and the order's raw
 * Salesforce status value — no hardcoded stage strings (CLAUDE.md §1).
 */
export function OrderTracker({ statusSf }: OrderTrackerProps) {
  const currentIndex = orderStageIndex(statusSf);

  return (
    <div className="track">
      {ORDER_PIPELINE.map((stage, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "cur" : "";
        return (
          <div key={stage.sfValue} className={`tstep ${state}`}>
            <div className="ring">{index < currentIndex ? "✓" : index + 1}</div>
            <div className="tl">{stage.label}</div>
          </div>
        );
      })}
    </div>
  );
}
