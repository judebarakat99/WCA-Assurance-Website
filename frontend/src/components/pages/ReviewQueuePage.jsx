"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import PageTemplate from "@/components/templates/PageTemplate";
import { toast } from "@/lib/domain/actions";
import { PILLARS, TIMELINE } from "@/lib/domain/cityAssurance.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { QUEUE_REASON, queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAssessments, hasSampleAssessments, loadSampleAssessments, reviewAssessment } from "@/lib/store/assessments";
import { updateMap } from "@/lib/store/state";

const REASON_TONE = { fail: "bad", "needs-review": "warn", pass: "good", "non-compliant": "bad" };
const CHECK_LABEL = { pass: "meets criterion", fail: "below criterion", "needs-review": "needs reviewer" };
// Every year on the map's timeline except the last, which means "any year".
const DUE_YEARS = Array.from({ length: TIMELINE.to - TIMELINE.from }, (_, i) => TIMELINE.from + i);
const COMPLETIONS = new Set(FACILITY_REGISTER.stadiums.map((s) => s.completionYear));
const STATUS_OPTIONS = [
  ["", "Everything"],
  ["evidence-submitted", "Awaiting review"],
  ["non-compliant", "Non-compliant"],
];

// City, area and year are shared with the assurance map (ui.map), so a filter
// set here is selected on the map and the other way round. The URL mirrors
// them, plus the queue-only status filter, so a filtered queue can be linked;
// a link's filters win over what the map had.
const fromYear = (y) => (y && y < TIMELINE.to ? y : null);
const shared = (m) => ({ city: m.city, area: m.pillar, year: fromYear(m.year) });

function queryOf({ city, area, year, status }) {
  const q = new URLSearchParams();
  if (city) q.set("city", city);
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
    area: params.get("area"),
    year: fromYear(Number(params.get("year")) || null),
  };
  const linked = params.has("city") || params.has("area") || params.has("year");
  const current = linked ? url : shared(ui.map);
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
  const set = (name, value) => write({ ...current, status, [name]: name === "year" ? Number(value) || null : value || null });
  const clear = () => write({ city: null, area: null, year: null, status: null });
  return [{ cityId: current.city, category: current.area, year: current.year, status }, set, clear];
}

function Filters({ filters, set }) {
  return (
    <div className="filters rq-filters">
      <label className="f">
        Host city
        <select value={filters.cityId || ""} onChange={(e) => set("city", e.target.value)}>
          <option value="">All host cities</option>
          {FACILITY_REGISTER.hostCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="f">
        Requirement area
        <select value={filters.category || ""} onChange={(e) => set("area", e.target.value)}>
          {PILLARS.map((p) => (
            <option key={p.label} value={p.id || ""}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="f">
        Stadiums due by
        <select value={filters.year || ""} onChange={(e) => set("year", e.target.value)}>
          <option value="">Any year</option>
          {DUE_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
              {COMPLETIONS.has(y) ? "" : " (no stadium completes)"}
            </option>
          ))}
        </select>
      </label>
      <label className="f">
        Showing
        <select value={filters.status || ""} onChange={(e) => set("status", e.target.value)}>
          {STATUS_OPTIONS.map(([v, label]) => (
            <option key={label} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function decide(item, outcome) {
  reviewAssessment(item.stadium.id, item.requirement, outcome);
  toast(`${item.stadium.name}, ${item.requirement.id}: ${outcome === "compliant" ? "compliant" : "non-compliant"}.`);
}

function Item({ item }) {
  const { stadium, city, requirement, evidence, record, reason } = item;
  return (
    <li className="rq-item">
      <div className="rq-where">
        <Link href={`/facilities/${stadium.id}`}>
          <b>{stadium.name}</b>
        </Link>
        <span className="muted small">
          {city.name} · due {stadium.completionYear}
        </span>
      </div>
      <div className="rq-what">
        <div>
          <span className="mono small">{requirement.id}</span> <b>{requirement.title}</b>
          {item.applicability.value === "provisional" && (
            <>
              {" "}
              <StatusPill tone="warn">Provisional</StatusPill>
            </>
          )}
        </div>
        <div className="muted small">
          Criterion <span className="mono">{criterionLabel(requirement.criterion)}</span>
          {evidence && (
            <>
              {" "}
              · {evidence.file}
              {evidence.value !== "" && evidence.value != null && <> · value {evidence.value}</>} · {evidence.on}
            </>
          )}
          {record.sample && " · sample data"}
        </div>
        <div>
          <StatusPill tone={REASON_TONE[reason]}>{QUEUE_REASON[reason]}</StatusPill>
          {evidence && reason !== "non-compliant" && (
            <span className="muted fine"> automatic check: {CHECK_LABEL[evidence.check]}</span>
          )}
        </div>
      </div>
      <div className="rq-act">
        {record.status === "evidence-submitted" ? (
          <>
            <button type="button" className="primary" onClick={() => decide(item, "compliant")}>
              Mark compliant
            </button>
            <button type="button" className="danger" onClick={() => decide(item, "non-compliant")}>
              Non-compliant
            </button>
          </>
        ) : (
          <Link className="btnlink" href={`/facilities/${stadium.id}`}>
            Record new evidence →
          </Link>
        )}
      </div>
    </li>
  );
}

function Queue({ ui }) {
  const [filters, set, clear] = useFilters(ui);
  const records = getAssessments();
  const items = reviewQueue(records, filters);
  const all = queueCounts(reviewQueue(records));
  const c = queueCounts(items);
  const filtered = Object.values(filters).some(Boolean);
  const tiles = [
    [c.total, filtered ? `shown of ${all.total}` : "need attention", ""],
    [c["evidence-submitted"], "awaiting review", c["evidence-submitted"] ? "warn" : ""],
    [c.fail, "evidence below criterion", c.fail ? "bad" : ""],
    [c["non-compliant"], "non-compliant, awaiting new evidence", c["non-compliant"] ? "bad" : ""],
  ];
  return (
    <>
      <PageHead
        chip="FIFA assurance · Review queue"
        title="Review queue"
        lead="Everything that needs a person, across all stadiums: submitted evidence waiting for a decision, and non-compliant items waiting for new evidence. Earliest stadiums come first; within a stadium, evidence that fails its check comes first."
      />
      <div className="mini-grid four">
        {tiles.map(([n, label, tone]) => (
          <div key={label} className={`mini ${tone}`.trim()}>
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Filters filters={filters} set={set} />
      {items.length ? (
        <ol className="rq-list">
          {items.map((item) => (
            <Item key={item.key} item={item} />
          ))}
        </ol>
      ) : (
        <div className="block rq-empty">
          <b>{all.total ? "Nothing matches these filters." : "Nothing needs review."}</b>
          <p className="muted small m0">
            {all.total ? (
              <button type="button" className="linkish" onClick={clear}>
                Clear filters
              </button>
            ) : hasSampleAssessments() ? (
              "Every submitted item has a decision."
            ) : (
              <>
                Only declared capacities are recorded so far.{" "}
                <button type="button" className="linkish" onClick={loadSampleAssessments}>
                  Load sample assessments
                </button>
              </>
            )}
          </p>
        </div>
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
