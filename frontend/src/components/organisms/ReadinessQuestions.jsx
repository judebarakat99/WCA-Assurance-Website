"use client";

import Legend from "@/components/atoms/Legend";
import Ring from "@/components/atoms/Ring";
import SegmentBar from "@/components/atoms/SegmentBar";
import StatusPill from "@/components/atoms/StatusPill";
import HBar from "@/components/molecules/HBar";
import Kpi from "@/components/molecules/Kpi";
import QuestionCard from "@/components/molecules/QuestionCard";
import QuestionRow from "@/components/molecules/QuestionRow";
import { fmtD, pct, sn, dd, venueMeta } from "@/lib/domain/data";
import {
  byCriticality,
  externalDependencies,
  falseGreens,
  lastSevenDays,
  lateWithoutDecision,
  nextInspection,
  openDecisions,
  ownerSlippage,
  recoveryScenario,
} from "@/lib/domain/readiness";
import { goView } from "@/lib/store/state";
import { openDossier, openRegister } from "@/lib/navigation";
import { STATE_COLOR, STATE_TONE, probTone, toneOf } from "@/lib/ui/tones";
import { openDrawer } from "@/legacy/views/drawer";

const plural = (n, one, many) => (n === 1 ? one : many);

function Link({ onClick, children }) {
  return (
    <button type="button" className="linkish" onClick={onClick}>
      {children}
    </button>
  );
}

function OkBig({ children }) {
  return (
    <div className="okbig">
      <i>✓</i>
      <span>{children}</span>
    </div>
  );
}

function FalseGreens() {
  const { claims, overturned, designOnly } = falseGreens();
  const parts = [
    { n: overturned.length, c: "var(--bad)", l: "overturned" },
    { n: claims.length - overturned.length, c: "var(--warn)", l: "unproven" },
    { n: designOnly.length, c: "var(--mint)", l: "proven on drawings only" },
  ];
  const top = claims.slice().sort(byCriticality).slice(0, 4);
  return (
    <QuestionCard
      n={2}
      question="Which greens are false?"
      visual={
        <>
          <Kpi
            value={claims.length}
            label={
              <>
                declared complete,
                <br />
                not proven
              </>
            }
            tone="t-warn"
          />
          <SegmentBar parts={parts} />
          <Legend parts={parts} />
        </>
      }
      answer={`${claims.length} items owners declared complete are not proven. ${overturned.length} ${overturned.length === 1 ? "was" : "were"} overturned by evidence.${designOnly.length ? ` ${designOnly.length} more are proven on drawings only, where the gate needs the built asset.` : ""}`}
      rows={top.map((o) => (
        <QuestionRow
          key={o.id}
          id={<Link onClick={() => openDrawer(o.id)}>{o.id}</Link>}
          aside={
            <StatusPill tone={o.state === "Rejected" ? "bad" : "warn"}>
              {o.state === "Rejected" ? "overturned" : "unproven"}
            </StatusPill>
          }
        >
          {o.text}
        </QuestionRow>
      ))}
      kind="ev"
      basis="owner declarations vs evidence"
      action={<Link onClick={() => openRegister()}>Register</Link>}
    />
  );
}

function NextInspection({ forecasts }) {
  const x = nextInspection(forecasts);
  if (!x) return null;
  const { next, evaluation, list, gaps } = x;
  const count = (s) => list.filter((o) => o.state === s).length;
  const parts = ["Verified", "Validated", "Submitted", "Assigned", "Rejected"].map((s) => ({
    n: count(s),
    c: STATE_COLOR[s],
    l: s.toLowerCase(),
  }));
  const name = venueMeta(next.id).name;
  return (
    <QuestionCard
      n={3}
      question="Where will FIFA push back at the next inspection?"
      visual={
        <>
          <div className="v3">
            <Ring parts={parts} value={`${parts[0].n + parts[1].n}/${list.length}`} label="proven" />
            <div className="v3-side">
              <div className="v3-name">{name}</div>
              <div className="flex">
                <StatusPill tone="mute">
                  {next.gate.id} · {fmtD(next.gateDate)}
                </StatusPill>
                <StatusPill tone={evaluation.pass ? "good" : "bad"}>
                  {evaluation.pass ? "Gate rules met" : "Gate rules failing"}
                </StatusPill>
              </div>
              <div className="v3-days">
                <b>{next.gateDays}</b> days to inspection
              </div>
            </div>
          </div>
          <Legend parts={parts} />
        </>
      }
      answer={`${name} is next (${next.gate.id} on ${fmtD(next.gateDate)}). ${evaluation.pass ? "It meets the gate rules, but" : "It fails the gate rules, and"} FIFA would still question ${gaps.length} Critical or High ${plural(gaps.length, "item", "items")} not yet verified.`}
      rows={gaps.slice(0, 3).map((o) => (
        <QuestionRow
          key={o.id}
          id={<Link onClick={() => openDrawer(o.id)}>{o.code}</Link>}
          aside={<StatusPill tone={STATE_TONE[o.state]}>{o.state}</StatusPill>}
        >
          {o.text}
        </QuestionRow>
      ))}
      kind="ev"
      basis="whole-venue evidence check"
      action={<Link onClick={() => openDossier(next.id)}>Dossier</Link>}
    />
  );
}

function Decisions({ forecasts }) {
  const open = openDecisions();
  const undecided = lateWithoutDecision(forecasts);
  const first = open[0];
  return (
    <QuestionCard
      n={4}
      question="What do I need to decide, and by when?"
      visual={
        <>
          <Kpi
            value={open.length}
            label={`${plural(open.length, "decision", "decisions")} open`}
            tone={open.length ? "t-warn" : "t-good"}
          />
          {open.slice(0, 3).map((d) => {
            const tone = d.left < 21 ? "bad" : d.left < 90 ? "warn" : "good";
            const width = Math.max(6, Math.min(100, Math.round((d.left / 365) * 100)));
            return (
              <div key={d.id} className="drow">
                <div className={`dday ${tone}`}>
                  <b>{Math.max(d.left, 0)}</b>
                  <span>days</span>
                </div>
                <div className="dmain">
                  <b>
                    {d.id} · {d.title}
                  </b>
                  <span>Decide by {fmtD(d.lrm)}</span>
                  <div className="mb-tr">
                    <i className={`p-${tone}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          {undecided.length > 0 && (
            <div className="vs-note">
              {undecided.length} late {plural(undecided.length, "venue has", "venues have")} no decision raised yet
            </div>
          )}
        </>
      }
      answer={
        first
          ? `The first decision must be taken by ${fmtD(first.lrm)}, ${first.left < 0 ? `${dd(first.left)} ago` : `in ${dd(first.left)}`}.`
          : "No decisions are waiting."
      }
      kind="dl"
      basis="last responsible moment per decision"
      action={<Link onClick={() => goView("actions")}>Decisions</Link>}
    />
  );
}

function RecoveryColumn({ label, x, highlight }) {
  const tone = x.cls ? toneOf(x.cls) : x.late80 <= 0 ? "good" : probTone(x.prob);
  return (
    <div className={`vs-col ${highlight ? "hl" : ""}`.trim()}>
      <div className="vs-l">{label}</div>
      <div className="vs-n">
        {pct(x.prob)}
        <small>%</small>
      </div>
      <div className="mb-tr big">
        <i className={`p-${tone}`} style={{ width: `${pct(x.prob)}%` }} />
      </div>
      <div className="vs-d">P80 {fmtD(x.d80)}</div>
      <StatusPill tone={x.late80 > 0 ? "bad" : "good"}>
        {x.late80 > 0 ? `${dd(x.late80)} late` : "inside milestone"}
      </StatusPill>
    </div>
  );
}

function Recovery({ worst }) {
  const r = recoveryScenario(worst);
  let visual, answer;
  if (!r.needed) {
    answer = "No venue is late at P80 under this scenario. No recovery is needed yet.";
    visual = <OkBig>No recovery needed</OkBig>;
  } else {
    const note = (
      <div className="vs-note">
        {sn(worst.id)} · milestone {fmtD(worst.gateDate)}
      </div>
    );
    if (r.deployed) {
      answer = `A recovery team is already deployed at ${sn(worst.id)}. P80 is still ${dd(worst.late80)} after the milestone, so the next lever is scope or a re-baseline with FIFA.`;
      visual = (
        <>
          <div className="vs one">
            <RecoveryColumn label="With recovery team" x={worst} highlight />
          </div>
          {note}
        </>
      );
    } else {
      answer = `A recovery team at ${sn(worst.id)} moves P80 from ${fmtD(worst.d80)} to ${fmtD(r.alt.d80)}, ${r.alt.late80 > 0 ? `still ${dd(r.alt.late80)} late` : "inside the milestone"}.`;
      visual = (
        <>
          <div className="vs">
            <RecoveryColumn label="Now" x={worst} />
            <div className="vs-ar" aria-hidden="true">
              →
            </div>
            <RecoveryColumn label="With recovery" x={r.alt} highlight />
          </div>
          {note}
        </>
      );
    }
  }
  return (
    <QuestionCard
      n={5}
      question="What would it take to recover the worst venue?"
      visual={visual}
      answer={answer}
      kind="fc"
      basis="recovery scenario re-run"
      action={r.needed ? <Link onClick={() => goView("actions")}>Decide</Link> : null}
    />
  );
}

function External() {
  const { ext, owners, critical } = externalDependencies();
  const max = Math.max(1, ...owners.map(([, k]) => k.n));
  return (
    <QuestionCard
      n={6}
      question="What depends on parties outside the programme?"
      visual={
        <>
          <Kpi
            value={ext.length}
            label={
              <>
                unproven, held by
                <br />
                outside parties
              </>
            }
            tone="t-warn"
          />
          <div className="hbs">
            {owners.map(([name, k]) => (
              <HBar
                key={name}
                name={name}
                segments={[
                  { n: k.c, k: "crit" },
                  { n: k.n - k.c, k: "oth" },
                ]}
                total={k.n}
                max={max}
              />
            ))}
          </div>
          <div className="leg">
            <span>
              <i className="crit" />
              {critical} Critical
            </span>
            <span>
              <i className="oth" />
              {ext.length - critical} other
            </span>
          </div>
        </>
      }
      answer={`${ext.length} unproven obligations sit with external owners, ${critical} of them Critical.`}
      kind="ev"
      basis="owner register"
      action={<Link onClick={() => openRegister()}>Register</Link>}
    />
  );
}

function LastWeek() {
  const w = lastSevenDays();
  const tiles = [
    [w.escalations, "escalations", "bad"],
    [w.rejections, "rejections", "bad"],
    [w.validations, "validated or verified", "good"],
    [w.declarations, "new declarations", "warn"],
  ];
  return (
    <QuestionCard
      n={7}
      question="What changed in the last 7 days?"
      visual={
        <div className="mini-grid">
          {tiles.map(([n, label, tone]) => (
            <div key={label} className={`mini ${tone}`}>
              <b>{n}</b>
              <span>{label}</span>
            </div>
          ))}
        </div>
      }
      answer={`${w.recent.length} recorded events since ${fmtD(w.since)}.`}
      rows={w.groups.map((g) => (
        <div key={g.key} className="tl-i">
          <span className="tl-d">{fmtD(g.a.t)}</span>
          <span className="tl-t">
            <b>{g.a.actor}</b> {g.a.action}
            {g.n > 1 ? ` (${g.n} items)` : ""}
          </span>
        </div>
      ))}
      kind="ev"
      basis="audit trail"
      action={<Link onClick={() => goView("tower")}>Activity</Link>}
    />
  );
}

function Owners() {
  const ranked = ownerSlippage();
  const top = ranked.slice(0, 4);
  const max = Math.max(1, ...top.map((x) => x.r + x.o));
  const visual = top.length ? (
    <>
      <Kpi value={top[0].n} label="carries the most slippage" tone="t-bad tx" />
      <div className="hbs">
        {top.map((x) => (
          <HBar
            key={x.n}
            name={x.n}
            segments={[
              { n: x.r, k: "crit" },
              { n: x.l, k: "late" },
              { n: x.o - x.l, k: "oth" },
            ]}
            total={x.r + x.o}
            max={max}
          />
        ))}
      </div>
      <div className="leg">
        <span>
          <i className="crit" />
          rejected
        </span>
        <span>
          <i className="late" />
          late or escalated
        </span>
        <span>
          <i className="oth" />
          open action
        </span>
      </div>
    </>
  ) : (
    <OkBig>No owner is behind</OkBig>
  );
  return (
    <QuestionCard
      n={8}
      question="Who is not delivering?"
      visual={visual}
      answer={
        ranked.length
          ? `${ranked.length} ${plural(ranked.length, "owner", "owners")} with rejections, open actions or late items.`
          : "No owner is behind."
      }
      kind="ev"
      basis="rejections, actions and SLA history"
      action={<Link onClick={() => goView("actions")}>Escalations</Link>}
    />
  );
}

/** Readiness questions 2–8 as a card grid. */
export default function ReadinessQuestions({ forecasts, worst }) {
  return (
    <div className="qgrid">
      <FalseGreens />
      <NextInspection forecasts={forecasts} />
      <Decisions forecasts={forecasts} />
      <Recovery worst={worst} />
      <External />
      <LastWeek />
      <Owners />
    </div>
  );
}
