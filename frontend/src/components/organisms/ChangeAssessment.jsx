"use client";

import Link from "next/link";
import { useState } from "react";
import StatusPill from "@/components/atoms/StatusPill";
import ImpactMap from "@/components/organisms/ImpactMap";
import { EXPOSURE } from "@/lib/domain/exposure.mjs";
import { pct } from "@/lib/format";
import { getAssessments } from "@/lib/store/assessments";
import { applyChange, discardChange, notifyOwners, notifyPlan } from "@/lib/watch/actions";
import { OUTCOME, OUTCOME_ORDER } from "@/lib/watch/impact.mjs";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] || "");
const SHOWN = 5;
const dateText = (d) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** What a person was just told after notifying the owners or applying a change. */
function Done({ done }) {
  if (!done) return null;
  if (done.type === "notify")
    return (
      <div className="ev-banner good" role="status">
        <div>
          <b>Owners notified.</b> {plural(done.count, "alert")} sent to {list(done.owners)}.
        </div>
        <div className="ev-banner-links">
          <Link href="/reports">Owner reports →</Link>
        </div>
      </div>
    );
  if (done.type === "apply")
    return (
      <div className="ev-banner good" role="status">
        <div>
          {done.kind === "new" ? (
            <>
              <b>Added.</b> {done.requirementId} is now in the register and applies at every stadium as not assessed.
            </>
          ) : (
            <>
              <b>Applied.</b> {done.requirementId} is now version {done.version}. {plural(done.reopened, "compliant item")} reopened for review.
            </>
          )}
        </div>
        <div className="ev-banner-links">
          <Link href={done.kind === "new" ? "/compliance?tab=library" : "/review?status=reopened"}>
            {done.kind === "new" ? "See it in the library →" : "Open the review queue →"}
          </Link>
        </div>
      </div>
    );
  return (
    <div className="ev-banner bad" role="alert">
      <div>The change could not be applied. It may already be in the register.</div>
    </div>
  );
}

function Applied({ item, done }) {
  const reopened = Object.values(getAssessments()).filter((r) => r.reopenedBy === item.scenario.id && r.status === "evidence-submitted").length;
  const isNew = item.kind === "new";
  return (
    <section className="block rw-detail rw-compact">
      <Done done={done} />
      <h3>{item.scenario.title}</h3>
      <p className="small m0">
        {isNew
          ? `Added to the register as ${item.scenario.newRequirement.id}. It applies at every stadium and shows as not assessed until evidence is recorded.`
          : `Applied to the register: ${item.scenario.requirementId} is now version ${item.applied.version}. ${reopened ? `${plural(reopened, "compliant item")} that no longer pass ${reopened === 1 ? "is" : "are"} waiting in the review queue.` : "Nothing recorded as compliant was reopened."}`}
      </p>
      {!isNew && (
        <p className="m0">
          <Link className="btnlink" href="/review?status=reopened">
            Open the reopened items in the review queue →
          </Link>
        </p>
      )}
    </section>
  );
}

/** The fulfilled share before and after: whole percentages, or one decimal when the change is too small to show otherwise. */
function shareText(a) {
  const x = a.programme.compliantBefore / a.programme.inScope;
  const y = a.programme.compliantAfter / a.programme.inScopeAfter;
  if (x === y) return `Fulfilled across the programme stays at ${pct(x)}%.`;
  const same = pct(x) === pct(y);
  const f = (v) => (same ? (v * 100).toFixed(1) : String(pct(v)));
  return `Fulfilled across the programme: ${f(x)}% to ${f(y)}%.`;
}

function headline(a) {
  if (a.kind === "new") {
    const soon = a.actionable.length;
    return soon
      ? `${plural(soon, "stadium")} should start assessing it soon.`
      : "No stadium needs to start assessing it yet.";
  }
  const parts = [];
  if (a.counts.reopened) parts.push(`${plural(a.counts.reopened, "compliant item")} would reopen`);
  if (a.counts.failsInReview) parts.push(`${plural(a.counts.failsInReview, "submission")} in review would fail`);
  return parts.length ? `${list(parts)}.` : "No compliant item or submission in review is affected.";
}

/** The affected stadiums, compact, each with a link to show it on the map. */
function Rows({ a, city, onCity }) {
  const [all, setAll] = useState(false);
  const sorted = [...a.rows].sort((x, y) => OUTCOME_ORDER.indexOf(x.outcome) - OUTCOME_ORDER.indexOf(y.outcome) || x.stadium.name.localeCompare(y.stadium.name));
  const inCity = city ? sorted.filter((r) => r.stadium.cityId === city.id) : null;
  const focus = sorted.filter((r) => r.actionable);
  const rows = inCity ? inCity : all ? sorted : focus.slice(0, SHOWN);
  const heading = inCity ? `Stadiums in ${city.name}` : a.kind === "new" ? "Stadiums to start with" : "Affected stadiums";
  const hidden = !inCity && !all ? focus.length - rows.length : 0;
  return (
    <div className="rw-rows-wrap">
      <div className="rw-rows-head">
        <h4>{heading}</h4>
        {inCity && (
          <button type="button" className="linkish small" onClick={() => onCity(null)}>
            All cities
          </button>
        )}
      </div>
      {!rows.length ? (
        <p className="muted small m0">No stadium is affected beyond not having evidence yet.</p>
      ) : (
        <ul className="rw-rows">
          {rows.map((r) => (
            <li key={r.stadium.id}>
              <div className="rw-row-main">
                <Link href={`/facilities/${r.stadium.id}`}>{r.stadium.name}</Link>
                <span className="muted fine">
                  {r.city} · due {r.stadium.completionYear}
                  {r.valueText ? ` · recorded ${r.valueText}` : ""}
                </span>
              </div>
              <div className="rw-row-side">
                <StatusPill tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].label}</StatusPill>
                <span className="muted fine">
                  {r.levelBefore ? EXPOSURE[r.levelBefore].label : "New"}
                  {r.levelBefore !== r.levelAfter && (
                    <>
                      {" → "}
                      <b>{EXPOSURE[r.levelAfter].label}</b>
                    </>
                  )}
                  {r.actionable && r.due ? ` · due ${dateText(r.due)}` : ""}
                </span>
                {!inCity && (
                  <button type="button" className="linkish fine" onClick={() => onCity(r.stadium.cityId)}>
                    Show on map
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!inCity && (hidden > 0 || all) && (
        <button type="button" className="linkish small" onClick={() => setAll((v) => !v)}>
          {all ? "Show only the affected" : `Show all ${a.rows.length} stadiums`}
        </button>
      )}
    </div>
  );
}

/** One proposed change: a heat map of who is affected, the numbers, and the two things a person can do. */
export default function ChangeAssessment({ item }) {
  const a = item.assessment;
  const [done, setDone] = useState(null);
  const [cityId, setCityId] = useState(null);
  if (!a) return <Applied item={item} done={done} />;
  const isNew = a.kind === "new";
  const plan = notifyPlan(a);
  const notified = item.state === "notified";
  const reopened = a.counts.reopened;
  const fails = a.counts.failsInReview;
  const id = isNew ? a.after.id : a.before.id;
  const cityIds = new Set(a.rows.map((r) => r.stadium.cityId));
  const city = cityId && cityIds.has(cityId) ? { id: cityId, name: a.rows.find((r) => r.stadium.cityId === cityId)?.city } : null;

  const notify = () => setDone({ type: "notify", ...notifyOwners(a) });
  const apply = () => {
    const result = applyChange(a.scenario.id);
    setDone(
      result
        ? { type: "apply", kind: isNew ? "new" : "amendment", requirementId: id, version: result.after?.version ?? a.after.version, reopened: result.counts?.reopened ?? reopened }
        : { type: "fail" },
    );
  };
  const tiles = isNew
    ? [
        [a.rows.length, "stadiums it applies to", ""],
        [a.actionable.length, "to start soon", a.actionable.length ? "warn" : "good"],
        [a.counts.notAssessed, "not assessed yet", ""],
        [a.owners.length, a.owners.length === 1 ? "owner to act" : "owners to act", a.owners.length ? "warn" : "good"],
      ]
    : [
        [reopened, "would reopen", reopened ? "bad" : "good"],
        [fails, "fail in review", fails ? "bad" : "good"],
        [a.counts.notAssessed, "not assessed yet", ""],
        [a.owners.length, a.owners.length === 1 ? "owner to act" : "owners to act", a.owners.length ? "warn" : "good"],
      ];

  return (
    <section className="block rw-detail rw-compact" aria-labelledby="rw-detail-title">
      <div className="rw-detail-head">
        <div>
          <h3 id="rw-detail-title">{a.scenario.title}</h3>
          <div className="rw-crit">
            {isNew ? (
              <>
                <StatusPill tone="info">New requirement</StatusPill>
                <span className="rw-chip on mono">{a.crit}</span>
              </>
            ) : (
              <>
                <span className="rw-chip mono">{a.before.id}</span>
                <span className="rw-chip">
                  v{a.before.version} <b className="mono">{a.oldCrit}</b>
                </span>
                <span aria-hidden="true">→</span>
                <span className="rw-chip on">
                  v{a.after.version} <b className="mono">{a.crit}</b>
                </span>
              </>
            )}
            <span className="muted small">
              Chapter {a.family?.id} {a.family?.name}
            </span>
          </div>
        </div>
        <StatusPill tone={notified ? "info" : "warn"}>{notified ? "Owners notified" : "New"}</StatusPill>
      </div>

      <div className="rw-impact">
        <ImpactMap rows={a.rows} kind={a.kind} crit={a.crit} selected={city?.id || null} onSelect={setCityId} />
        <div className="rw-side">
          <p className="rw-summary m0">{headline(a)}</p>
          <div className="rw-tiles2">
            {tiles.map(([n, label, tone]) => (
              <div key={label} className={`mini ${tone}`.trim()}>
                <b>{n}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="muted small m0">{shareText(a)}</p>
          <Rows a={a} city={city} onCity={setCityId} />
        </div>
      </div>

      <Done done={done} />

      <div className="rw-actions2">
        <div className="rw-act">
          <p className="small m0">
            {notified
              ? `Owners were notified: ${plural(item.alerts.length, "alert")} in the alerts list.`
              : plan.ready
                ? `Sends ${plural(plan.count, "alert")} to ${list(plan.owners)}.`
                : "Nothing to send: no stadium needs to act."}
          </p>
          <button type="button" className="primary" disabled={!plan.ready || notified} onClick={notify}>
            {notified ? "Owners notified" : "Notify owners"}
          </button>
        </div>
        <div className="rw-act">
          <p className="small m0">
            {isNew
              ? `Adds ${id} to the register at every stadium, as not assessed.`
              : `${id} moves to version ${a.after.version}. ${reopened ? `${plural(reopened, "compliant item")} reopen in the review queue.` : fails ? `${plural(fails, "submission")} in review are re-checked.` : "Nothing recorded as compliant reopens."}`}
          </p>
          <button type="button" className="primary" onClick={apply}>
            {isNew ? "Add to the register" : "Apply to the register"}
          </button>
        </div>
      </div>

      <div className="rw-more">
        <details>
          <summary className="clickable small">How the agent assessed this</summary>
          <ol className="pf-steps">
            {a.steps.map((s, i) => (
              <li key={i} className={s.ok ? "ok" : "flag"}>
                <b>{s.label}</b>
                <span>{s.detail}</span>
              </li>
            ))}
          </ol>
        </details>
        <details>
          <summary className="clickable small">By delivery stage and related requirements</summary>
          <ul className="rw-mini">
            {a.byStage.map((c) => (
              <li key={c.key} className="small">
                <b>{c.key}</b> · {plural(c.stadiums, "stadium")}: {isNew ? `${c.notAssessed} not assessed` : `${c.reopened} reopen, ${c.failsInReview} fail in review`}
              </li>
            ))}
          </ul>
          {a.gates.length > 0 && <p className="small m0">Next gates at risk: {a.gates.map((g) => `${g.gate} (${plural(g.count, "stadium")})`).join(", ")}.</p>}
          {a.related.length > 0 && (
            <p className="muted small m0">
              Read with this change, in the same book section: {list(a.related.slice(0, 4).map((r) => `${r.id} ${r.title}`))}
              {a.related.length > 4 ? ` and ${a.related.length - 4} more` : ""}.
            </p>
          )}
        </details>
      </div>

      {item.custom && (
        <p className="m0 small">
          <button type="button" className="linkish small" onClick={() => discardChange(a.scenario.id)}>
            Remove this change
          </button>
          <span className="muted"> · It has not been applied, so nothing else changes.</span>
        </p>
      )}
    </section>
  );
}
