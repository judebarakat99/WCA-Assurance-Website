// Obligation drawer: which obligation is open (ui.drawerId) and its actions.
import { SLA, critText, showVal } from "@/lib/domain/data";
import { S, log, save, updateUi } from "@/lib/store/state";
import { validate, verify } from "@/lib/domain/actions";

const find = (id) => S.obligations.find((o) => o.id === id);

export function openDrawer(id) {
  updateUi({ drawerId: id, lastResult: null });
}

export function closeDrawer() {
  updateUi({ drawerId: null });
}

/** Validate the latest submitted evidence against the criterion. */
export function runValidation(id) {
  const o = find(id);
  if (!o || o.state !== "Submitted") return;
  const ok = validate(o);
  const e = o.evidence[o.evidence.length - 1];
  save();
  updateUi({
    lastResult: {
      ok,
      msg: ok
        ? `Pass: ${showVal(o, e.value)} meets the criterion.`
        : `Fail: ${showVal(o, e.value)} does not meet ${critText(o)}. The owner's "complete" is overturned, status set to Rejected, corrective action opened with a ${SLA[o.crit]}-day SLA.`,
    },
  });
}

/** Second-line verification of a validated obligation. */
export function verifyObligation(id) {
  const o = find(id);
  if (!o || o.state !== "Validated") return;
  verify(o);
  save();
  updateUi({
    lastResult: {
      ok: true,
      msg: "Verified by the compliance office. This obligation now counts fully toward assured readiness.",
    },
  });
}

/** Record new evidence from the drawer form and validate it at once. */
export function submitEvidence(id, { file, issuer, maturity, value }) {
  const o = find(id);
  if (!o) return;
  const val = o.op === "bool" ? value : Number(value);
  o.evidence.push({
    file: file || "evidence.pdf",
    issuer,
    value: val,
    date: S.today,
    result: "pending",
    reviewer: null,
    maturity: Number(maturity),
  });
  o.state = "Submitted";
  log(o.owner, "Submitted evidence", o.id);
  const ok = validate(o);
  save();
  updateUi({
    lastResult: {
      ok,
      msg: ok
        ? `Pass: ${showVal(o, val)} meets ${critText(o)}. Ready for second-line verification.`
        : `Fail: ${showVal(o, val)} does not meet ${critText(o)}. Status set to Rejected and a corrective action opened.`,
    },
  });
}

