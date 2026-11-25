"use client";

import StatusPill from "@/components/atoms/StatusPill";
import { criterionText, shortDate } from "@/lib/reports/text.mjs";
import { addedRequirements, customScenarios } from "@/lib/watch/custom";

/** Requirements a person added from the Requirement watch, listed with the library. Nothing is shown until one is added. */
export default function AddedRequirements() {
  const added = addedRequirements();
  if (!added.length) return null;
  const scenarios = customScenarios();
  return (
    <section className="comp-block" aria-labelledby="added-requirements-title">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">Added requirements</span>
          <h2 id="added-requirements-title">Added from the Requirement watch</h2>
          <p>
            {added.length} requirement{added.length === 1 ? "" : "s"} added to the register. Each applies at every stadium and shows as not assessed until evidence is recorded.
          </p>
        </div>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Requirement</th>
              <th scope="col">Criterion</th>
              <th scope="col">Chapter</th>
              <th scope="col">Added from</th>
            </tr>
          </thead>
          <tbody>
            {added.map((r) => {
              const s = scenarios.find((x) => x.newRequirement?.id === r.id);
              return (
                <tr key={r.id}>
                  <td>
                    <span className="mono">{r.id}</span>
                    <br />
                    {r.title}
                  </td>
                  <td>
                    <b>{criterionText(r.criterion)}</b>
                    <div className="muted fine">
                      <StatusPill tone="warn">Provisional</StatusPill>
                    </div>
                  </td>
                  <td>
                    {r.familyId} · {r.category}
                  </td>
                  <td className="small">
                    {s?.source ? (s.source.type === "document" ? s.source.name : "Typed text") : "Requirement watch"}
                    {s?.appliedOn && <div className="muted fine">{shortDate(s.appliedOn)}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
