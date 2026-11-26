import Link from "next/link";

/**
 * A numbered workflow. steps: [{ label, hint, href? }]; current is the 1-based step in progress.
 * Earlier steps show a tick; a step with href links on.
 */
export default function Stepper({ steps, current, label }) {
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((step, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "next";
        const body = (
          <>
            <span className="stepper-n">{state === "done" ? "✓" : n}</span>
            <span className="stepper-t">
              <b>{step.label}</b>
              <small>{step.hint}</small>
            </span>
          </>
        );
        return (
          <li key={step.label} className={state} aria-current={state === "now" ? "step" : undefined}>
            {step.href ? <Link href={step.href}>{body}</Link> : body}
          </li>
        );
      })}
    </ol>
  );
}
