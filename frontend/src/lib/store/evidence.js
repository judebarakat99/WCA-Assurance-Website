// The Evidence page's logic: what confirming a document would do (shown before the button is pressed), what it
// does, and the progress check that follows for reports and plans. The pages read and the actions change the same stores as everything
// else (intake, assessments, alerts), so every page shows the result.
import { assessmentKey } from "@/lib/domain/assessment.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { currentRequirement } from "@/lib/domain/requirementVersions.mjs";
import { getAlerts } from "@/lib/store/alerts";
import { getAssessments } from "@/lib/store/assessments";
import { checkableStadiums, filedDocuments, fileDocument, intake, refreshIntake, runCheck } from "@/lib/store/intake";
import { localReanalyse } from "@/lib/store/intakeLocal";
import { notify } from "@/lib/store/state";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : items[0] || "");

/** The status word for a record, as the stadium page shows it. */
export function statusLabel(record) {
  if (!record) return "Not assessed";
  if (record.status === "non-compliant") return record.partial ? "Partially compliant" : "Non-compliant";
  if (record.status === "evidence-submitted") return "Evidence submitted";
  if (record.status === "compliant") return "Compliant";
  return "Not assessed";
}

/**
 * What confirming would do, in plain lines, before anything happens.
 * Returns { ready, blocked, lines: [{ text, tone?, indent? }], alerts, owners }.
 */
export function describeEffect(doc, form) {
  const kind = form.kind;
  const stadium = FACILITY_REGISTER.stadiums.find((s) => s.id === form.stadium_id);
  if (!kind || kind === "other") return { ready: false, blocked: "Choose a type to continue.", lines: [{ text: "A document of this type is not recorded anywhere. Choose what it is to continue." }], alerts: 0, owners: [] };
  if (!stadium) return { ready: false, blocked: "Choose the stadium first.", lines: [{ text: "The agent could not tell which stadium this is. Choose it under Edit details." }], alerts: 0, owners: [] };
  if (kind === "detailed-plan" && !form.element) return { ready: false, blocked: "Choose the scope element first.", lines: [{ text: "Choose which scope element this plan covers under Edit details." }], alerts: 0, owners: [] };

  const lines = [];
  const filed = filedDocuments().filter((d) => d.stadium_id === stadium.id && !d.superseded);
  const plans = filed.filter((d) => d.kind === "detailed-plan");
  const report = filed.find((d) => d.kind === "progress-report");
  const elementName = (id) => intake.elements.find((e) => e.id === id)?.name || id;

  if (kind === "evidence") {
    const records = getAssessments();
    const matches = (doc.analysis?.matches || []).filter((m) => m.record);
    if (!matches.length) {
      lines.push({ text: "No requirement in the register matches this document, so nothing would be recorded against a requirement. It would still be kept on file." });
    } else {
      lines.push({ text: `Records this document as evidence for ${plural(matches.length, "requirement")} at ${stadium.name}:` });
      for (const m of matches) {
        const req = currentRequirement(m.requirement_id);
        const rec = req ? records[assessmentKey(stadium.id, req)] : null;
        const value = m.value !== null ? ` (${m.value}${m.unit ? ` ${m.unit}` : ""}${m.verdict === "below" ? ", below the criterion" : ""})` : "";
        lines.push({ text: `${m.requirement_id} ${m.title}: ${statusLabel(rec)} → Evidence submitted${value}`, tone: m.verdict === "below" ? "bad" : null, indent: true });
      }
      lines.push({ text: "These join the review queue; a reviewer then decides each one." });
      const reopens = matches.filter((m) => m.reopens).length;
      if (reopens) lines.push({ text: `${plural(reopens, "requirement")} recorded as compliant would be reopened for review.`, tone: "bad" });
    }
  } else if (kind === "progress-report") {
    const same = filed.find((d) => d.kind === "progress-report");
    lines.push({ text: `Becomes the current progress report for ${stadium.name}${same ? `, replacing ${same.name}` : ""}.` });
    lines.push({ text: plans.length ? `The verification agent then checks the reported progress against the ${plural(plans.length, "detailed plan")} on file.` : "No detailed plans are on file yet, so the check will show each scope element as missing evidence until plans are filed." });
    lines.push({ text: "The register is not changed." });
  } else if (kind === "detailed-plan") {
    const same = filed.find((d) => d.kind === "detailed-plan" && d.element === form.element);
    lines.push({ text: `Becomes the current ${elementName(form.element).toLowerCase()} plan for ${stadium.name}${same ? `, replacing ${same.name}` : ""}.` });
    lines.push({ text: report ? "The verification agent then re-checks the reported progress against it." : "No progress report is on file yet. The check runs as soon as one is filed." });
    lines.push({ text: "The register is not changed." });
  }

  const alerts = kind === "evidence" ? doc.analysis?.alerts || [] : [];
  const owners = [...new Set(alerts.map((a) => a.owner))];
  if (kind === "evidence") lines.push({ text: alerts.length ? `Sends ${plural(alerts.length, "alert")} to ${list(owners)}.` : "No alerts are needed." });
  return { ready: true, blocked: null, lines, alerts: alerts.length, owners };
}

/**
 * Confirm one document: file it, record its evidence (evidence documents) and start the progress check (reports and
 * plans). Returns what happened, for the confirmation shown on the page.
 */
export async function confirmDocument(doc, filing) {
  const id = doc.document_id;
  await fileDocument(id, filing);
  const now = intake.documents.find((d) => d.document_id === id);
  if (!now || now.status !== "filed") return { failed: true, id, name: doc.name, error: intake.error || "The document could not be filed." };
  const result = { id, name: doc.name, kind: filing.kind, stadiumId: filing.stadium_id, stadium: FACILITY_REGISTER.stadiums.find((s) => s.id === filing.stadium_id)?.name || "", registered: now.registered || [], alerts: 0, owners: [], checkStarted: false };
  if (filing.kind === "evidence") {
    const raised = getAlerts().filter((a) => a.source?.id === id);
    result.alerts = raised.length;
    result.owners = [...new Set(raised.map((a) => a.owner))];
  }
  if ((filing.kind === "progress-report" || filing.kind === "detailed-plan") && checkableStadiums().some((s) => s.id === filing.stadium_id)) {
    result.checkStarted = true;
    runCheck(filing.stadium_id); // runs in the background; Project progress shows the finding
  }
  return result;
}

/** The agent reads an evidence document again for the stadium the person chose. */
export async function reanalyse(docId, stadiumId) {
  localReanalyse(docId, stadiumId);
  await refreshIntake();
  notify();
}
