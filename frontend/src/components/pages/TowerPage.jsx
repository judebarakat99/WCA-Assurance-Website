"use client";

import Meter from "@/components/atoms/Meter";
import SegmentBar from "@/components/atoms/SegmentBar";
import KpiTile from "@/components/molecules/KpiTile";
import PageHead from "@/components/molecules/PageHead";
import Section from "@/components/molecules/Section";
import VenueCard from "@/components/organisms/VenueCard";
import PageTemplate from "@/components/templates/PageTemplate";
import { LEVELS, VENUES, pct } from "@/lib/domain/data";
import { scores } from "@/lib/domain/scoring";
import { LEVEL_COLOR, stateParts } from "@/lib/ui/tones";

const DECLARED_COLOR = "color-mix(in srgb,var(--warn) 55%,var(--surface))";

function DualBar({ assured, declared }) {
  return (
    <div className="dual">
      <i className="d" style={{ width: `${pct(declared)}%` }} />
      <i className="a" style={{ width: `${pct(assured)}%` }} />
    </div>
  );
}

function SummaryTiles({ S, open }) {
  const all = S.obligations;
  const sc = scores(all);
  const overdue = open.filter((i) => S.today > i.due).length;
  const count = (state) => all.filter((o) => o.state === state).length;
  const rejected = count("Rejected");
  const levels = LEVELS.map((l, i) => ({
    n: open.filter((x) => x.level === i).length,
    c: LEVEL_COLOR[i],
    l: l.toLowerCase(),
  }));
  return (
    <section className="hero ct-summary" aria-label="Programme summary">
      <div className="grid tiles">
        <KpiTile
          label="Assured readiness"
          value={`${pct(sc.assured)}%`}
          visual={<Meter value={pct(sc.assured)} tone="good" />}
          note="weighted by criticality"
        />
        <KpiTile
          label="Declared by owners"
          value={`${pct(sc.declared)}%`}
          visual={<DualBar assured={sc.assured} declared={sc.declared} />}
          note={
            <>
              assurance gap <b>{pct(sc.declared - sc.assured)} pts</b>
            </>
          }
          tone="warn"
        />
        <KpiTile
          label="Obligations"
          value={all.length}
          visual={<SegmentBar parts={stateParts(all)} />}
          note={`${count("Verified")} verified · ${count("Submitted")} awaiting validation`}
        />
        <KpiTile
          label="Evidence rejected"
          value={rejected}
          visual={<Meter value={(rejected / Math.max(1, all.length)) * 100} tone="bad" />}
          note="failed the acceptance criterion"
          tone={rejected ? "alert" : undefined}
        />
        <KpiTile
          label="Open issues"
          value={open.length}
          visual={<SegmentBar parts={levels} />}
          note={`${overdue} past SLA`}
          tone={overdue ? "alert" : undefined}
        />
      </div>
    </section>
  );
}

function Tower({ S }) {
  const open = S.issues.filter((i) => i.status === "Open");
  return (
    <>
      <PageHead
        chip={`Control tower · ${VENUES.length} venues and base camps · ${S.obligations.length} obligations`}
        title="Programme readiness"
        lead="Assured readiness counts only obligations backed by validated evidence. The gap to what owners declare is the risk a status report would hide."
      />
      <SummaryTiles S={S} open={open} />
      <Section
        eyebrow="Where we stand"
        title="Venues and base camps"
        aside={
          <div className="legend">
            <span>
              <i style={{ background: "var(--brand-deep)" }} />
              Assured
            </span>
            <span>
              <i style={{ background: DECLARED_COLOR }} />
              Declared, not yet proven
            </span>
          </div>
        }
      >
        <div className="grid venues">
          {VENUES.map((m) => (
            <VenueCard key={m.id} meta={m} S={S} openIssues={open} />
          ))}
        </div>
      </Section>
    </>
  );
}

export default function TowerPage() {
  return <PageTemplate label="Control Tower">{(p) => <Tower S={p.S} />}</PageTemplate>;
}
