// Compliance intake actions: simulated evidence processing and adding
// decomposed clauses to the register. State lives in ui.intake / ui.deco*.
import {
  EV_TYPES,
  EV_STEPS,
  critText,
  showVal,
  goodValue,
  badValue,
  passes,
  venueMeta,
} from "@/lib/domain/data";
import { S, ui, log, save, rerender, goView } from "@/lib/store/state";
import { oblsOf, issueFor } from "@/lib/domain/scoring";
import { validate, toast } from "@/lib/domain/actions";

const STEP_MS = 650;
const EMPTY_RUN = { step: -1, running: false, result: null, added: false };

/** Obligations and open corrective actions available as intake targets for the chosen venue. */
export function intakeTargets() {
  const obligations = oblsOf(ui.intake.venue);
  const issues = S.issues.filter((i) => i.status === "Open" && obligations.some((o) => o.id === i.obl));
  return { obligations, issues };
}

/** The obligation behind the selected target ("obl:<id>" or "iss:<id>"), or null. */
export function intakeObligation() {
  const t = ui.intake.target;
  if (!t) return null;
  const id = t.startsWith("iss:") ? S.issues.find((i) => i.id === t.slice(4))?.obl : t.slice(4);
  return S.obligations.find((o) => o.id === id) || null;
}

/** Update intake fields; changing venue, target or file restarts the run. */
export function setIntake(patch) {
  const restart = "venue" in patch || "target" in patch || "fileName" in patch;
  ui.intake = { ...ui.intake, ...patch, ...(restart ? EMPTY_RUN : null) };
  if ("venue" in patch) ui.intake.target = "";
  rerender();
}

export function resetIntake() {
  ui.intake = { ...ui.intake, ...EMPTY_RUN, fileName: "" };
  rerender();
}

/** Walk through the simulated processing steps, then record the extracted value. */
export function runIntake() {
  const o = intakeObligation();
  if (!o) return toast("Choose an obligation or corrective action first.");
  if (!ui.intake.fileName) return toast("Choose or drop a document first.");
  const fail = /fail|reject|short|low|bad/i.test(ui.intake.fileName);
  const value = o.op === "bool" ? !fail : fail ? badValue(o) : goodValue(o);
  ui.intake = { ...ui.intake, running: true, step: 0, result: null, added: false };
  rerender();
  const tick = () => {
    if (!ui.intake.running) return;
    const step = ui.intake.step + 1;
    if (step >= EV_STEPS.length) {
      ui.intake = { ...ui.intake, step, running: false, result: { oid: o.id, val: value, ok: passes(o, value) } };
      rerender();
      return;
    }
    ui.intake = { ...ui.intake, step };
    rerender();
    setTimeout(tick, STEP_MS);
  };
  setTimeout(tick, STEP_MS);
}

/** Add the processed document as evidence and validate it against the criterion. */
export function addIntakeEvidence() {
  const r = ui.intake.result;
  if (!r || ui.intake.added) return;
  const o = S.obligations.find((x) => x.id === r.oid);
  if (!o) return;
  o.evidence.push({
    file: ui.intake.fileName,
    issuer: "Evidence intake (simulated)",
    value: r.val,
    date: S.today,
    result: "pending",
    reviewer: null,
    maturity: EV_TYPES[ui.intake.etype][1],
  });
  o.state = "Submitted";
  o.claim = true;
  log(o.owner, "Submitted evidence via evidence intake", o.id);
  const ok = validate(o);
  ui.intake = { ...ui.intake, added: true };
  save();
  rerender();
  toast(
    ok
      ? `Pass: ${showVal(o, r.val)} meets ${critText(o)}. ${o.id} validated${issueFor(o) ? "" : " and any open action closed"}.`
      : `Fail: ${showVal(o, r.val)} does not meet ${critText(o)}. ${o.id} rejected and a corrective action opened.`,
  );
}

/** Add the kept decomposed clauses to the register for the chosen venue. */
export function addDecomposed() {
  const v = venueMeta(ui.decoVenue);
  const kept = (ui.decoOut || []).filter((d) => d.keep);
  for (const d of kept) {
    const code = `NEW-${String(S.seq++).padStart(2, "0")}`;
    const o = {
      code,
      family: d.fam,
      clause: `Pasted clause §${d.ref}`,
      text: d.text,
      op: d.op,
      value: d.value,
      unit: d.unit,
      crit: d.crit,
      gate: "G4",
      owner: "To be assigned",
      id: `${v.id}-${code}`,
      venue: v.id,
      evidence: [],
      state: "Assigned",
      claim: false,
    };
    S.obligations.push(o);
    log("Compliance office", "Obligation created from decomposed clause", o.id);
  }
  save();
  ui.filters = { venue: v.id, family: "all", state: "Assigned", q: "" };
  goView("register");
  toast(`${kept.length} obligations added to ${v.name}.`);
}
