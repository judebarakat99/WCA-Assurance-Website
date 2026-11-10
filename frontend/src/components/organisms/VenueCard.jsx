"use client";

import GateDots from "@/components/atoms/GateDots";
import Ring from "@/components/atoms/Ring";
import StatusPill from "@/components/atoms/StatusPill";
import { GATES, fmtD, pct, dd, daysBetween } from "@/lib/domain/data";
import { scores, oblsOf, venueState, gateEval, isProven } from "@/lib/domain/scoring";
import { projection } from "@/lib/domain/forecast";
import { openGates, openRegister, openVenue } from "@/lib/navigation";
import { toneOf } from "@/lib/ui/tones";

const gapTone = (gap) => (gap >= 15 ? "bad" : gap >= 5 ? "warn" : "good");

// Distinct Critical obligations blocking the venue's next gate.
function criticalBlockers(id) {
  const e = gateEval(id);
  if (!e) return 0;
  const ids = e.rules
    .filter((r) => !r.ok)
    .flatMap((r) => r.blockers)
    .filter((o) => o && o.crit === "Critical")
    .map((o) => o.id);
  return new Set(ids).size;
}

/** A venue on the Control Tower: assured vs declared readiness, next gate and quick links. */
export default function VenueCard({ meta, S, openIssues }) {
  const list = oblsOf(meta.id);
  const s = scores(list);
  const p = projection(meta.id);
  const v = venueState(meta.id);
  const gate = v.gateIdx < GATES.length ? GATES[v.gateIdx] : null;
  const issues = openIssues.filter((i) => list.some((o) => o.id === i.obl)).length;
  const blockers = criticalBlockers(meta.id);
  const gap = pct(s.declared - s.assured);
  const days = gate ? daysBetween(S.today, v.gateDate) : 0;
  return (
    <article className="venue">
      <div className="head">
        <div style={{ minWidth: 0 }}>
          <div className="name">{meta.name}</div>
          <div className="meta">{[meta.city, meta.type, meta.role].filter(Boolean).join(" · ")}</div>
        </div>
        <StatusPill tone={toneOf(p.cls)}>{p.status}</StatusPill>
      </div>
      <div className="vbody">
        <Ring
          parts={[
            { n: s.assured, c: "var(--brand-deep)" },
            { n: Math.max(s.declared - s.assured, 0), c: "color-mix(in srgb,var(--warn) 55%,var(--surface))" },
            { n: Math.max(1 - Math.max(s.declared, s.assured), 0), c: "var(--sunk)" },
          ]}
          value={`${pct(s.assured)}%`}
          label="assured"
          size="sm"
        />
        <div className="vside">
          <div className="vline">
            <span>Declared by owners</span>
            <b>{pct(s.declared)}%</b>
          </div>
          <div className="vline">
            <span>Assurance gap</span>
            <StatusPill tone={gapTone(gap)}>{gap} pts</StatusPill>
          </div>
          <div className="vline">
            <span>Obligations proven</span>
            <b>
              {list.filter(isProven).length}/{list.length}
            </b>
          </div>
        </div>
      </div>
      <div className="vgate">
        <GateDots index={v.gateIdx} />
        <div className="vg-t">
          {gate ? (
            <>
              <b>
                {gate.id} {gate.name}
              </b>
              <span>
                {fmtD(v.gateDate)} · {days < 0 ? `${dd(days)} overdue` : `${dd(days)} to go`}
                {p.f && ` · P80 ${fmtD(p.f.d80)}`}
              </span>
            </>
          ) : (
            <b>All gates passed</b>
          )}
        </div>
      </div>
      <div className="flex">
        <StatusPill tone={issues ? "bad" : "mute"}>
          {issues} open issue{issues === 1 ? "" : "s"}
        </StatusPill>
        {blockers > 0 && (
          <StatusPill tone="bad">
            {blockers} critical blocker{blockers === 1 ? "" : "s"}
          </StatusPill>
        )}
        <span className="spacer" />
        <button type="button" className="linkish" onClick={() => openRegister(meta.id)}>
          Obligations
        </button>
        <button type="button" className="linkish" onClick={() => openGates(meta.id)}>
          Gate check
        </button>
      </div>
      <div className="vmore">
        <button type="button" className="vdetail-btn" onClick={() => openVenue(meta.id)}>
          View stadium details →
        </button>
      </div>
    </article>
  );
}
