"use client";

import Eyebrow from "@/components/atoms/Eyebrow";
import Legend from "@/components/atoms/Legend";
import SegmentBar from "@/components/atoms/SegmentBar";
import Breadcrumbs from "@/components/molecules/Breadcrumbs";
import Kpi from "@/components/molecules/Kpi";
import PageHead from "@/components/molecules/PageHead";
import GateCard from "@/components/organisms/GateCard";
import PageTemplate from "@/components/templates/PageTemplate";
import { VENUES } from "@/lib/domain/data";
import { venueState, gateEval } from "@/lib/domain/scoring";

const plural = (n, word) => `${word}${n === 1 ? "" : "s"}`;

function Gates() {
  const rows = VENUES.map((m) => ({ meta: m, venue: venueState(m.id), evaluation: gateEval(m.id) }));
  const ready = rows.filter((r) => r.evaluation?.pass).length;
  const blocked = rows.filter((r) => r.evaluation && !r.evaluation.pass).length;
  const done = rows.filter((r) => !r.evaluation).length;
  const failing = rows.reduce(
    (a, r) => a + (r.evaluation ? r.evaluation.rules.filter((x) => !x.ok).length : 0),
    0,
  );
  const parts = [
    { n: ready, c: "var(--good)", l: "ready to pass" },
    { n: blocked, c: "var(--bad)", l: "blocked" },
    { n: done, c: "var(--brand-deep)", l: "all gates passed" },
  ];
  return (
    <>
      <Breadcrumbs label="Readiness gates" />
      <PageHead
        chip={`Readiness gates · ${ready} ready · ${blocked} blocked`}
        title="Readiness gates"
        lead="A gate cannot pass while its rules fail. The engine lists every blocker and can escalate them in one step."
      />
      <div className="sumrow">
        <div className="sumcard">
          <Eyebrow>Gate status</Eyebrow>
          <Kpi
            value={blocked}
            label={`${plural(blocked, "venue")} blocked at their next gate`}
            tone={blocked ? "t-bad" : "t-good"}
          />
          <SegmentBar parts={parts} />
          <Legend parts={parts} />
        </div>
        <div className="sumcard">
          <Eyebrow>Failing rules</Eyebrow>
          <Kpi
            value={failing}
            label={`${plural(failing, "rule")} failing across all venues`}
            tone={failing ? "t-warn" : "t-good"}
          />
          <div className="muted small">Each blocked gate lists the obligations holding it back.</div>
        </div>
      </div>
      <div className="grid">
        {rows.map((r) => (
          <GateCard key={r.meta.id} {...r} />
        ))}
      </div>
    </>
  );
}

export default function GatesPage() {
  return <PageTemplate label="Readiness gates">{() => <Gates />}</PageTemplate>;
}
