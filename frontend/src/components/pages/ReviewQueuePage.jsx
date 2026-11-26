"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import PageHead from "@/components/molecules/PageHead";
import StatTiles from "@/components/molecules/StatTiles";
import ProgressClaimList from "@/components/organisms/ProgressClaimList";
import QueueFilters from "@/components/organisms/QueueFilters";
import QueueItem from "@/components/organisms/QueueItem";
import PageTemplate from "@/components/templates/PageTemplate";
import { TIMELINE } from "@/lib/domain/cityAssurance.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAssessments } from "@/lib/store/assessments";
import { ensureIntake, intake, needsDecision } from "@/lib/store/intake";
import { updateMap } from "@/lib/store/state";

// City, area and year are shared with the assurance map (ui.map), so a filter
// set here is selected on the map and the other way round. The URL mirrors
// them, plus the queue-only status filter, so a filtered queue can be linked;
// a link's filters win over what the map had.
const fromYear = (y) => (y && y < TIMELINE.to ? y : null);
const shared = (m) => ({ city: m.city, area: m.pillar, year: fromYear(m.year) });

function queryOf({ city, stadium, area, year, status }) {
  const q = new URLSearchParams();
  if (city) q.set("city", city);
  if (stadium) q.set("stadium", stadium);
  if (area) q.set("area", area);
  if (year) q.set("year", String(year));
  if (status) q.set("status", status);
  return q.toString();
}

function useFilters(ui) {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const url = {
    city: params.get("city"),
    stadium: params.get("stadium"),
    area: params.get("area"),
    year: fromYear(Number(params.get("year")) || null),
  };
  const linked = params.has("city") || params.has("stadium") || params.has("area") || params.has("year");
  const current = linked ? url : { ...shared(ui.map), stadium: null };
  const status = params.get("status") || null;
  const query = queryOf({ ...current, status });

  // On arrival: a link's filters go to the map; otherwise the map's go to the URL.
  useEffect(() => {
    const m = shared(ui.map);
    if (linked && (url.city !== m.city || url.area !== m.area || url.year !== m.year)) {
      updateMap({ city: url.city, pillar: url.area, year: url.year || TIMELINE.to });
    }
    if (query !== params.toString()) router.replace(query ? `${path}?${query}` : path, { scroll: false });
    // Runs when the URL changes; ui.map changes only come from set() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const write = (next) => {
    updateMap({ city: next.city, pillar: next.area, year: next.year || TIMELINE.to });
    const q = queryOf(next);
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  };
  const set = (name, value) =>
    write({ ...current, status, [name]: name === "year" ? Number(value) || null : value || null });
  const clear = () => write({ city: null, stadium: null, area: null, year: null, status: null });
  return [
    { cityId: current.city, stadiumId: current.stadium, category: current.area, year: current.year, status },
    set,
    clear,
  ];
}

// Progress claims the agent flagged, awaiting a reviewer. They follow the stadium, city and due-year filters and
// show only under "Everything".
function progressClaims(filters) {
  if (filters.status) return [];
  return Object.values(intake.checks).filter((c) => {
    const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === c.stadium_id);
    return (
      needsDecision(c) &&
      stadium &&
      (!filters.stadiumId || stadium.id === filters.stadiumId) &&
      (!filters.cityId || stadium.cityId === filters.cityId) &&
      (!filters.year || stadium.completionYear <= filters.year)
    );
  });
}

function Empty({ any, clear }) {
  return (
    <div className="block rq-empty">
      <b>{any ? "Nothing matches these filters." : "Nothing needs review."}</b>
      <p className="muted small m0">
        {any ? (
          <button type="button" className="linkish" onClick={clear}>
            Clear filters
          </button>
        ) : (
          "Every submitted item has a decision."
        )}
      </p>
    </div>
  );
}

function Queue({ ui }) {
  const [filters, set, clear] = useFilters(ui);
  useEffect(ensureIntake, []);
  const claims = progressClaims(filters);
  const allClaims = progressClaims({});
  const records = getAssessments();
  const items = reviewQueue(records, filters);
  const all = queueCounts(reviewQueue(records));
  const c = queueCounts(items);
  const filtered = Object.values(filters).some(Boolean);
  return (
    <>
      <PageHead
        chip="Compliance · Review queue"
        title="Review queue"
        wideLead
        lead="Everything that needs a person, across all stadiums: submitted evidence waiting for a decision, and non-compliant items waiting for new evidence. Evidence just confirmed on the Evidence page comes first, then the earliest stadiums; within a stadium, evidence that fails its check comes first."
      />
      <StatTiles
        tiles={[
          {
            value: c.total + claims.length,
            label: filtered ? `shown of ${all.total + allClaims.length}` : "need attention",
          },
          { value: c["evidence-submitted"], label: "awaiting review", tone: c["evidence-submitted"] ? "warn" : "" },
          { value: c.fail, label: "evidence below criterion", tone: c.fail ? "bad" : "" },
          {
            value: c["non-compliant"],
            label: "not fulfilled, awaiting new evidence",
            tone: c["non-compliant"] ? "bad" : "",
          },
        ]}
      />
      <QueueFilters filters={filters} set={set} />
      <ProgressClaimList claims={claims} />
      {items.length ? (
        <ol className="rq-list">
          {items.map((item) => (
            <QueueItem key={item.key} item={item} />
          ))}
        </ol>
      ) : (
        <Empty any={all.total > 0} clear={clear} />
      )}
    </>
  );
}

/** Cross-stadium queue of assessments awaiting a decision or remediation. */
export default function ReviewQueuePage() {
  return (
    <PageTemplate label="Review queue">
      {({ ui }) => (
        <Suspense fallback={null}>
          <Queue ui={ui} />
        </Suspense>
      )}
    </PageTemplate>
  );
}
