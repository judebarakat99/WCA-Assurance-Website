"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import PageTemplate from "@/components/templates/PageTemplate";
import { toast } from "@/lib/ui/toast";
import { PILLARS, TIMELINE } from "@/lib/domain/cityAssurance.mjs";
import { criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { QUEUE_REASON, queueCounts, reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAssessments, reviewAssessment } from "@/lib/store/assessments";
import { CHECK_STATUS, decideCheck, ensureIntake, intake, needsDecision } from "@/lib/store/intake";
import { updateMap } from "@/lib/store/state";
import { getDemoEvidence, subscribeDemoEvidence } from "@/lib/store/demoEvidence";

const REASON_TONE = { fail: "bad", "needs-review": "warn", pass: "good", "non-compliant": "bad", "partially-compliant": "warn" };
// Every year on the map's timeline except the last, which means "any year".
const DUE_YEARS = Array.from({ length: TIMELINE.to - TIMELINE.from }, (_, i) => TIMELINE.from + i);
const COMPLETIONS = new Set(FACILITY_REGISTER.stadiums.map((s) => s.completionYear));
const STATUS_OPTIONS = [
  ["", "Everything"],
  ["evidence-submitted", "Awaiting review"],
  ["non-compliant", "Non-compliant"],
  ["reopened", "Reopened by a change"],
];

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
  const set = (name, value) => write({ ...current, status, [name]: name === "year" ? Number(value) || null : value || null });
  const clear = () => write({ city: null, stadium: null, area: null, year: null, status: null });
  return [{ cityId: current.city, stadiumId: current.stadium, category: current.area, year: current.year, status }, set, clear];
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
        Stadium
        <select value={filters.stadiumId || ""} onChange={(e) => set("stadium", e.target.value)}>
          <option value="">All stadiums</option>
          {FACILITY_REGISTER.stadiums.map((stadium) => (
            <option key={stadium.id} value={stadium.id}>
              {stadium.name}
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
          {item.reopenedBy && (
            <>
              {" "}
              <StatusPill tone="bad">Reopened by {item.reopenedBy}</StatusPill>
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
        </div>
        <div>
          <StatusPill className="rq-status" tone={REASON_TONE[reason]}>
            {QUEUE_REASON[reason]}
          </StatusPill>
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
          <Link
            className="btn primary"
            href={`/evidence?stadium=${encodeURIComponent(stadium.id)}&purpose=${encodeURIComponent(`${requirement.id} · ${requirement.title}`)}`}
          >
            Record new evidence
          </Link>
        )}
      </div>
    </li>
  );
}

// Progress claims the agent flagged, awaiting a reviewer (from the Intake page).
// They follow the city and due-year filters and show only under "Everything".
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

function ProgressClaims({ claims }) {
  if (!claims.length) return null;
  return (
    <>
      <h3 className="rq-heading">Progress claims not supported by evidence</h3>
      <ol className="rq-list">
        {claims.map((c) => (
          <li key={c.stadium_id} className="rq-item">
            <div className="rq-where">
              <Link href={`/facilities/${c.stadium_id}`}>
                <b>{c.stadium_name}</b>
              </Link>
              <span className="muted small">
                {c.city} · report as at {c.as_of}
              </span>
            </div>
            <div className="rq-what">
              <div>
                <b>
                  Reported {c.claimed}%, recalculated {c.recalculated}% from the detailed plans
                </b>
              </div>
              <div className="muted small">{c.summary}</div>
              <div>
                <StatusPill tone={CHECK_STATUS[c.status].tone}>{CHECK_STATUS[c.status].label}</StatusPill>{" "}
                <Link className="small" href={`/intake?stadium=${encodeURIComponent(c.stadium_id)}`}>
                  View finding →
                </Link>
              </div>
            </div>
            <div className="rq-act">
              <button type="button" className="primary" onClick={() => decideCheck(c.stadium_id, "accepted")}>
                Accept finding
              </button>
              <button type="button" className="ghost" onClick={() => decideCheck(c.stadium_id, "rejected")}>
                Reject finding
              </button>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="rq-heading">Requirement evidence</h3>
    </>
  );
}

function DemoEvidenceCard({ evidence }) {
  if (!evidence) return null;
  const stadium = FACILITY_REGISTER.stadiums.find((item) => item.id === evidence.stadium);
  return (
    <li className="rq-item">
      <div className="rq-where">
        <span className="rq-new">★ New</span>{" "}
        {stadium ? <Link href={`/facilities/${stadium.id}`}><b>{stadium.name}</b></Link> : <b>{evidence.stadium}</b>}
        <span className="muted small">Evidence confirmed in this session</span>
      </div>
      <div className="rq-what">
        <div><b>{evidence.name}</b></div>
        <div className="muted small">{evidence.purpose}</div>
        <div><StatusPill tone="good">Confirmed</StatusPill></div>
      </div>
      <div className="rq-act">
        {stadium && <Link className="small" href={`/facilities/${stadium.id}`}>Open stadium →</Link>}
      </div>
    </li>
  );
}

function Queue({ ui, readiness = false }) {
  const [filters, set, clear] = useFilters(ui);
  const [demoEvidence, setDemoEvidence] = useState(() => getDemoEvidence());
  useEffect(ensureIntake, []);
  useEffect(() => subscribeDemoEvidence(setDemoEvidence), []);
  const claims = progressClaims(filters);
  const allClaims = progressClaims({});
  const records = getAssessments();
  const items = reviewQueue(records, filters);
  const all = queueCounts(reviewQueue(records));
  const c = queueCounts(items);
  const filtered = Object.values(filters).some(Boolean);
  const tiles = [
    [c.total + claims.length, filtered ? `shown of ${all.total + allClaims.length}` : "need attention", ""],
    [c["evidence-submitted"], "awaiting review", c["evidence-submitted"] ? "warn" : ""],
    [c.fail, "evidence below criterion", c.fail ? "bad" : ""],
    [c["non-compliant"], "not fulfilled, awaiting new evidence", c["non-compliant"] ? "bad" : ""],
  ];
  return (
    <>
      <PageHead
        chip={readiness ? "Compliance · Readiness gates" : "Compliance · Review queue"}
        title={readiness ? "Readiness Gates" : "Review queue"}
        wideLead
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
      {demoEvidence && <ol className="rq-list"><DemoEvidenceCard evidence={demoEvidence} /></ol>}
      <ProgressClaims claims={claims} />
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
            ) : (
              "Every submitted item has a decision."
            )}
          </p>
        </div>
      )}
    </>
  );
}

/** Cross-stadium queue of assessments awaiting a decision or remediation. */
export default function ReviewQueuePage({ readiness = false }) {
  return (
    <PageTemplate label={readiness ? "Readiness Gates" : "Review queue"}>
      {({ ui }) => (
        <Suspense fallback={null}>
          <Queue ui={ui} readiness={readiness} />
        </Suspense>
      )}
    </PageTemplate>
  );
}
