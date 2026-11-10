"use client";

import Legend from "@/components/atoms/Legend";
import Ring from "@/components/atoms/Ring";
import StatusPill from "@/components/atoms/StatusPill";
import Section from "@/components/molecules/Section";
import Select from "@/components/molecules/Select";
import { CHANGES, sn, showVal, venueMeta } from "@/lib/domain/data";
import { applyChange, changeImpact } from "@/lib/domain/actions";
import { updateUi } from "@/lib/store/state";
import { openDrawer } from "@/legacy/views/drawer";

const OUTCOME = {
  flip: ["bad", "✕", "flips to fail"],
  ok: ["good", "✓", "stays compliant"],
  fail: ["warn", "!", "already failing"],
  none: ["mute", "–", "criterion updated"],
};
const outcome = (r) => (r.flip ? "flip" : !r.e ? "none" : r.nw ? "ok" : "fail");

function PassFail({ pass }) {
  return <StatusPill tone={pass ? "good" : "bad"}>{pass ? "Pass" : "Fail"}</StatusPill>;
}

/** Simulated guideline update: which obligations stop complying, and applying it. */
export default function ChangeImpact({ S, ui }) {
  const change = CHANGES.find((x) => x.id === ui.selChange);
  const rows = changeImpact(change);
  const flips = rows.filter((r) => r.flip);
  const applied = S.applied?.includes(change.id);
  const count = (k) => rows.filter((r) => outcome(r) === k).length;
  const venues = new Set(rows.map((r) => r.o.venue)).size;
  const parts = [
    { n: count("flip"), c: "var(--bad)", l: "newly failing" },
    { n: count("ok"), c: "var(--good)", l: "still compliant" },
    { n: count("fail"), c: "var(--warn)", l: "already failing" },
    { n: count("none"), c: "color-mix(in srgb,var(--muted) 30%,var(--sunk))", l: "no evidence yet" },
  ];
  return (
    <Section id="changeBlock" eyebrow="Change impact" title={`Change impact · ${rows.length} obligations · ${venues} venues`}>
      <p className="muted section-intro">
        When FIFA updates a guideline or a design changes, the engine re-tests existing evidence against the new rule
        and shows what silently stops complying. New requirement → impact assessment → evidence submission →
        validation → readiness, action and gate status change. The updates below are simulated.
      </p>
      <div className="filters">
        <Select
          id="chSel"
          label="Guideline update"
          value={change.id}
          onChange={(id) => updateUi({ selChange: id })}
          options={CHANGES.map((x) => [x.id, x.title])}
        />
      </div>
      <div className="sumcard mxcard">
        <div className="eyebrow">Impact by venue</div>
        <div className="mxs">
          {rows.map((r) => {
            const [tone, icon, label] = OUTCOME[outcome(r)];
            return (
              <button key={r.o.id} type="button" className={`mx ${tone}`} onClick={() => openDrawer(r.o.id)}>
                <i>{icon}</i>
                <span>{sn(r.o.venue)}</span>
                <small>{label}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid cols mt-lg">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Obligation</th>
                <th>Venue</th>
                <th>Current evidence</th>
                <th>Old rule</th>
                <th>New rule</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.o.id} className={r.flip ? "flip" : undefined}>
                  <td className="mono">
                    <button type="button" className="linkish" onClick={() => openDrawer(r.o.id)}>
                      {r.o.id}
                    </button>
                  </td>
                  <td>{venueMeta(r.o.venue).name}</td>
                  <td className="mono">{r.e ? showVal(r.o, r.e.value) : "none yet"}</td>
                  <td>{r.e ? <PassFail pass={r.old} /> : "–"}</td>
                  <td>{r.e ? <PassFail pass={r.nw} /> : <span className="muted">criterion updated</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <div className="eyebrow">Previously compliant, now failing</div>
          <div className="v3 impact-ring">
            <Ring parts={parts} value={flips.length} label={`of ${rows.length}`} size="sm" />
            <div className="v3-side">
              <div className="impact-num">{flips.length}</div>
              <div className="muted small">
                {flips.length === 1 ? "obligation flips" : "obligations flip"} to Rejected
              </div>
            </div>
          </div>
          <Legend parts={parts} />
          <p className="muted section-intro impact-note">
            {rows.length} obligations across {venues} venues carry this clause. Applying the update re-baselines the
            criterion, reverts failing evidence to Rejected and opens corrective actions.
          </p>
          <button type="button" className="primary" id="applyChange" disabled={applied} onClick={applyChange}>
            {applied ? "Update applied" : "Apply update"}
          </button>
        </div>
      </div>
    </Section>
  );
}
