// ---------- actions: validation, issues, escalation, decisions, changes ----------
import {
  LEVELS,
  SLA,
  GATES,
  CHANGES,
  esc,
  addDays,
  passes,
  showVal,
  critText,
  fmtD,
  decMeta,
  venueMeta,
} from "@/lib/domain/data";
import { S, log, save, rerender, ui, tour } from "@/lib/store/state";
import { issueFor, venueState } from "@/lib/domain/scoring";
import { forecast } from "@/lib/domain/forecast";

export function toast(msg) {
  const r = document.querySelector("#toastRoot");
  if (!r) return;
  r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (r.innerHTML = ""), 3200);
}
export function openIssue(o, title, level) {
  let i = issueFor(o);
  if (i) {
    if (level !== undefined && level > i.level) {
      i.level = level;
      i.history.push({ t: S.today, a: `Escalated to ${LEVELS[level]}` });
    }
    return i;
  }
  const lv = level || 0;
  i = {
    id: "ISS-" + String(S.seq++).padStart(3, "0"),
    obl: o.id,
    title,
    crit: o.crit,
    level: lv,
    opened: S.today,
    due: addDays(S.today, SLA[o.crit]),
    status: "Open",
    history: [{ t: S.today, a: `Opened at ${LEVELS[lv]}` }],
  };
  S.issues.push(i);
  log("Rule engine", `Corrective action ${i.id} opened (${LEVELS[lv]})`, o.id);
  return i;
}
export function validate(o) {
  const e = o.evidence[o.evidence.length - 1];
  if (!e) return;
  const ok = passes(o, e.value);
  e.result = ok ? "pass" : "fail";
  e.reviewer = "Rule engine";
  if (ok) {
    o.state = "Validated";
    log("Rule engine", "Evidence validated against criterion", o.id);
    const i = issueFor(o);
    if (i) {
      i.status = "Closed";
      i.closed = S.today;
      i.history.push({
        t: S.today,
        a: "Closed: closure verified by validated evidence",
      });
      log("Rule engine", `${i.id} closed by evidence`, o.id);
    }
  } else {
    o.state = "Rejected";
    log(
      "Rule engine",
      `Evidence rejected: ${showVal(o, e.value)} against ${critText(o)}`,
      o.id,
    );
    openIssue(o, `${o.text}: evidence fails criterion`);
  }
  return ok;
}
export function verify(o) {
  if (o.state !== "Validated") return;
  o.state = "Verified";
  o.verifiedBy = "Compliance office";
  log("Compliance office", "Verified by second line", o.id);
}
export function advance() {
  S.today = addDays(S.today, 7);
  let n = 0;
  S.issues
    .filter((i) => i.status === "Open")
    .forEach((i) => {
      if (S.today > i.due && i.level < LEVELS.length - 1) {
        i.level++;
        i.due = addDays(S.today, Math.ceil(SLA[i.crit] / 2));
        i.history.push({
          t: S.today,
          a: `SLA missed, escalated to ${LEVELS[i.level]}`,
        });
        log("Rule engine", `${i.id} escalated to ${LEVELS[i.level]}`, i.obl);
        n++;
      }
    });
  S.decisions.forEach((r) => {
    const d = decMeta(r.id);
    if (r.status === "Open" && !r.missed && S.today > d.lrm) {
      r.missed = true;
      log(
        "Rule engine",
        `${d.id} passed its last responsible moment without a decision`,
        null,
      );
    }
  });
  save();
  rerender();
  toast(
    n
      ? `Clock moved to ${fmtD(S.today)}. ${n} issue${n > 1 ? "s" : ""} escalated for missed SLA.`
      : `Clock moved to ${fmtD(S.today)}. No SLAs missed.`,
  );
}

export const decRec = (id) => S.decisions.find((d) => d.id === id);
export function decide(id, idx) {
  const d = decMeta(id),
    r = decRec(id);
  if (!d || !r || r.status !== "Open") return;
  const opt = d.options[idx];
  if (!opt) return;
  const before = forecast(d.venue);
  if (!before) return;
  if (opt.fx === "recover" && !S.scn.recovery.includes(d.venue))
    S.scn.recovery.push(d.venue);
  if (opt.fx === "rebase") {
    const v = venueState(d.venue);
    v.gateDate = addDays(v.gateDate, 90);
  }
  const after = forecast(d.venue);
  Object.assign(r, {
    status: "Taken",
    choice: idx,
    t: S.today,
    before: before.d80,
    after: after.d80,
    beforeLate: before.late80,
    afterLate: after.late80,
    beforeProb: before.prob,
    afterProb: after.prob,
  });
  log(d.owner, `${d.id} decided: ${opt.t}`, null);
  save();
  rerender();
  if (!tour.active)
    toast(
      `${d.id}: ${opt.t}. P80 moved from ${fmtD(before.d80)} to ${fmtD(after.d80)}.`,
    );
}

// ---------- change impact ----------
export function changeImpact(c) {
  const aff = S.obligations.filter(
    (o) => o.code === c.code && !(c.skip || []).includes(o.venue),
  );
  return aff.map((o) => {
    const e = o.evidence[o.evidence.length - 1];
    const old = e ? passes(o, e.value) : null;
    const nw = e
      ? passes(Object.assign({}, o, { value: c.value }), e.value)
      : null;
    return { o, e, old, nw, flip: e && e.result !== "fail" && old && !nw };
  });
}
export function applyChange() {
  const c = CHANGES.find((x) => x.id === ui.selChange);
  let n = 0;
  S.obligations
    .filter((o) => o.code === c.code && !(c.skip || []).includes(o.venue))
    .forEach((o) => {
      o.value = c.value;
      o.clause += " (rev. 2)";
      log("Compliance office", `Criterion re-baselined: ${c.title}`, o.id);
      const e = o.evidence[o.evidence.length - 1];
      if (
        e &&
        e.result !== "pending" &&
        !passes(o, e.value) &&
        (o.state === "Validated" || o.state === "Verified")
      ) {
        o.state = "Rejected";
        e.result = "fail";
        n++;
        openIssue(o, `Re-test needed after guideline update`);
        log("Rule engine", "Evidence no longer meets revised criterion", o.id);
      }
    });
  S.applied = (S.applied || []).concat(c.id);
  save();
  rerender();
  toast(
    `${n} obligation${n === 1 ? "" : "s"} reverted to Rejected and corrective actions opened.`,
  );
}

// ---------- requirement decomposition (rule-based PoC) ----------
export function decompose(text) {
  const sents = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.;])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
  let ref = "";
  return sents
    .map((s) => {
      const m = s.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
      if (m) {
        ref = m[1];
        s = m[2];
      }
      const t = s.replace(/^[A-Z][a-z]+\.\s+/, "");
      const binding = /\b(shall|must|is required to)\b/i.test(t),
        advisory = /\bshould\b/i.test(t) && !binding;
      if (!binding && !advisory) return null;
      const num = t.match(
        /(?<![A-Za-z\d.])(\d[\d,]*\.?\d*)\s*(lux|seconds|second|minutes|min|m²|m2|m|seats|positions|rooms|°C|%|kV|kW)?/i,
      );
      let op = "bool",
        value = null,
        unit = "";
      if (num) {
        value = Number(num[1].replace(/,/g, ""));
        unit = (num[2] || "").replace("m2", "m²");
        if (/not less than|at least|minimum|no fewer than/i.test(t)) op = "min";
        else if (/not exceed|maximum|no more than|within|up to/i.test(t))
          op = "max";
        else op = "eq";
      }
      const fam = /lux|illumin|uniform|glare|floodlight/i.test(t)
        ? "Floodlighting"
        : /power|supply|ups/i.test(t)
          ? "Power"
          : /emergency/i.test(t)
            ? "Safety & security"
            : "General";
      const crit =
        binding && op !== "bool" ? "Critical" : binding ? "High" : "Medium";
      return {
        ref: ref || "–",
        text: t.replace(/\.$/, ""),
        binding,
        op,
        value,
        unit,
        fam,
        crit,
        keep: binding,
      };
    })
    .filter(Boolean);
}

// ---------- gate pass / escalation ----------
import { gateEval as gateEvalFn } from "@/lib/domain/scoring";
export function requestGatePass(id) {
  const e = gateEvalFn(id),
    v = venueState(id);
  if (e.pass) {
    v.passed.push({ gate: e.gate.id, t: S.today });
    v.gateIdx++;
    if (v.gateIdx < GATES.length) v.gateDate = addDays(v.gateDate, 240);
    log("Compliance office", `Gate ${e.gate.id} ${e.gate.name} passed`, null);
    toast(`${venueMeta(id).name} passed ${e.gate.id} ${e.gate.name}.`);
  } else {
    const n = e.rules.filter((r) => !r.ok).length;
    log(
      "Rule engine",
      `Gate ${e.gate.id} request refused for ${venueMeta(id).name}: ${n} rule${n > 1 ? "s" : ""} failing`,
      null,
    );
    toast(
      `Gate refused: ${n} rule${n > 1 ? "s" : ""} failing. Escalate the blockers or fix the evidence.`,
    );
  }
  save();
  rerender();
}
export function escalateGateBlockers(id) {
  const e = gateEvalFn(id);
  const seen = new Set();
  let n = 0;
  e.rules.forEach((r) =>
    r.blockers.forEach((o) => {
      if (seen.has(o.id) || o.crit === "Medium") return;
      seen.add(o.id);
      openIssue(o, `Gate ${e.gate.id} blocker: ${o.text}`, 2);
      n++;
    }),
  );
  save();
  rerender();
  toast(`${n} blockers escalated to ${LEVELS[2]}.`);
}
export function escalateIssue(id) {
  const i = S.issues.find((x) => x.id === id);
  i.level++;
  i.due = addDays(S.today, Math.ceil(SLA[i.crit] / 2));
  i.history.push({ t: S.today, a: `Escalated manually to ${LEVELS[i.level]}` });
  log("Compliance office", `${i.id} escalated to ${LEVELS[i.level]}`, i.obl);
  save();
  rerender();
}
