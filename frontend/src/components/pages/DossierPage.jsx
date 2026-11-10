"use client";

import { useRef } from "react";
import Legend from "@/components/atoms/Legend";
import Ring from "@/components/atoms/Ring";
import SegmentBar from "@/components/atoms/SegmentBar";
import StatusPill from "@/components/atoms/StatusPill";
import HBar from "@/components/molecules/HBar";
import PageHead from "@/components/molecules/PageHead";
import Select from "@/components/molecules/Select";
import PageTemplate from "@/components/templates/PageTemplate";
import { GATES, VENUES, fmtN, fmtD, pct, showVal, venueMeta } from "@/lib/domain/data";
import { scores, oblsOf, venueState, isProven } from "@/lib/domain/scoring";
import { toast } from "@/lib/domain/actions";
import { dossierText } from "@/lib/domain/dossier";
import { updateUi } from "@/lib/store/state";
import { STATE_TONE, stateParts } from "@/lib/ui/tones";

const OP = { min: "≥ ", max: "≤ ", eq: "= " };

function Summary({ S, list }) {
  const sc = scores(list);
  const ready = list.filter(isProven).length;
  const openIssues = S.issues.filter((i) => i.status === "Open" && list.some((o) => o.id === i.obl)).length;
  const families = [...new Set(list.map((o) => o.family))].map((f) => {
    const l = list.filter((o) => o.family === f);
    return { f, n: l.length, p: l.filter(isProven).length };
  });
  const parts = stateParts(list);
  return (
    <div className="dsum">
      <div className="dsum-r">
        <Ring
          parts={[
            { n: sc.assured, c: "var(--brand-deep)" },
            { n: Math.max(1 - sc.assured, 0), c: "var(--sunk)" },
          ]}
          value={`${pct(sc.assured)}%`}
          label="assured"
          size="lg"
        />
      </div>
      <div className="dsum-m">
        <div className="mini-grid">
          <div className="mini good">
            <b>
              {ready}/{list.length}
            </b>
            <span>evidence-backed</span>
          </div>
          <div className={`mini ${openIssues ? "bad" : "good"}`}>
            <b>{openIssues}</b>
            <span>open issues</span>
          </div>
        </div>
        <SegmentBar parts={parts} />
        <Legend parts={parts} />
      </div>
      <div className="dsum-f">
        <div className="eyebrow">By requirement family</div>
        <div className="hbs">
          {families.map((x) => (
            <HBar
              key={x.f}
              name={x.f}
              segments={[
                { n: x.p, k: "good" },
                { n: x.n - x.p, k: "oth" },
              ]}
              total={`${x.p}/${x.n}`}
              max={x.n}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FamilyTable({ obligations }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Ref</th>
            <th>Requirement</th>
            <th>Criterion (illustrative)</th>
            <th>Evidence</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {obligations.map((o) => {
            const e = o.evidence[o.evidence.length - 1];
            return (
              <tr key={o.id}>
                <td className="mono">
                  {o.code}
                  <div className="muted">{o.clause}</div>
                </td>
                <td>{o.text}</td>
                <td className="mono">{o.op === "bool" ? "yes" : `${OP[o.op]}${fmtN(o.value)} ${o.unit}`}</td>
                <td>
                  {e ? (
                    <>
                      {e.file}
                      <div className="muted fine">
                        {e.issuer} · {fmtD(e.date)} · {showVal(o, e.value)}
                      </div>
                    </>
                  ) : (
                    <span className="muted">No evidence</span>
                  )}
                </td>
                <td>
                  <StatusPill tone={STATE_TONE[o.state]}>{o.state}</StatusPill>
                  {o.verifiedBy && <div className="muted fine">{o.verifiedBy}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Dossier({ S, ui }) {
  const docRef = useRef(null);
  const meta = venueMeta(ui.dossierVenue);
  const venue = venueState(meta.id);
  const list = oblsOf(meta.id);
  const families = [...new Set(list.map((o) => o.family))];
  const audit = S.audit
    .filter((a) => a.obl && a.obl.startsWith(`${meta.id}-`))
    .slice(-12)
    .reverse();
  const nextGate = venue.gateIdx < GATES.length ? `${GATES[venue.gateIdx].id} ${GATES[venue.gateIdx].name}` : "none";
  const facts = [
    meta.type,
    meta.role,
    meta.capacity && `planned capacity about ${fmtN(meta.capacity)}`,
    `next gate ${nextGate}`,
  ]
    .filter(Boolean)
    .join(" · ");

  async function copy() {
    try {
      await navigator.clipboard.writeText(dossierText(meta.id));
      toast("Dossier copied.");
    } catch {
      const range = document.createRange();
      range.selectNodeContents(docRef.current);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      toast("Dossier selected. Copy it with your keyboard.");
    }
  }

  return (
    <>
      <PageHead
        chip={`Inspection dossier · ${meta.name}`}
        title="FIFA inspection dossier"
        lead="Generated from validated evidence and the audit trail, in requirement order. Nothing in it is self-declared."
      />
      <div className="filters">
        <Select
          id="dvSel"
          label="Venue"
          value={meta.id}
          onChange={(id) => updateUi({ dossierVenue: id })}
          options={VENUES.map((v) => [v.id, v.name])}
        />
        <button type="button" id="copyDossier" onClick={copy}>
          Copy as text
        </button>
      </div>
      <article className="dossier" id="dossierDoc" ref={docRef}>
        <div className="stamp">COMPLIANCE DOSSIER · GENERATED {fmtD(S.today).toUpperCase()} · SAMPLE DATA</div>
        <h2 className="dossier-title">
          {meta.name}, {meta.city}
        </h2>
        <p className="muted m0">{facts}</p>
        <Summary S={S} list={list} />
        {families.map((f) => (
          <div key={f}>
            <h3>{f}</h3>
            <FamilyTable obligations={list.filter((o) => o.family === f)} />
          </div>
        ))}
        <h3>Audit trail</h3>
        <div className="tl">
          {audit.map((a, k) => (
            <div key={k} className="tli mid">
              <i />
              <div>
                <span className="mono muted">{fmtD(a.t)}</span>
                <div>
                  {a.obl}: <b>{a.actor}</b> {a.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

export default function DossierPage() {
  return <PageTemplate label="FIFA inspection dossier">{(p) => <Dossier {...p} />}</PageTemplate>;
}
