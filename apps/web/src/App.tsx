import { ORDER_STAGES, type OrderStage } from "@wsc/shared";

/**
 * Phase-0 placeholder shell. The five real views (Dashboard, My Order, Payments,
 * Documents, Profile) are ported from `public/prototype.html` in Phase 4. This
 * renders the canonical pipeline straight from `@wsc/shared` — proving the shared
 * package imports into the web app (Phase 0 DoD).
 */
export function App() {
  const currentStage: OrderStage = "Work Started";

  return (
    <main className="wsc-shell">
      <h1 className="wsc-title">WSC Client Portal</h1>
      <p className="wsc-sub">
        Phase 0 skeleton — the design prototype lives at{" "}
        <a href="/prototype.html">/prototype.html</a>.
      </p>
      <ol className="wsc-pipeline" aria-label="Order status pipeline">
        {ORDER_STAGES.map((stage) => (
          <li
            key={stage}
            className={stage === currentStage ? "is-current" : ""}
            aria-current={stage === currentStage ? "step" : false}
          >
            {stage}
          </li>
        ))}
      </ol>
    </main>
  );
}
