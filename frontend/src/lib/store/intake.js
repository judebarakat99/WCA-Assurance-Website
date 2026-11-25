// Evidence page state: contractor documents, progress checks and the agent's
// visible progress. Everything runs in the browser (lib/store/intakeLocal);
// every change calls notify() so useProgramme() components re-render.
import { assessDocument, PROGRAMME_OWNER } from "@/lib/domain/evidenceReader.mjs";
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { addAlerts, clearAlerts, getAlerts } from "@/lib/store/alerts";
import { getAssessments, recordEvidence } from "@/lib/store/assessments";
import {
  localCheck,
  localClear,
  localDecide,
  localFile,
  localRemove,
  localSeed,
  localState,
  localUpload,
} from "@/lib/store/intakeLocal";
import { notify } from "@/lib/store/state";

export const MAX_UPLOAD = 10 * 1024 * 1024;

export const intake = {
  loaded: false,
  stadiums: [],
  elements: [],
  documents: [],
  checks: {},
  uploads: [], // in flight or failed: { key, name, stage, error }
  running: {}, // stadium id -> true while a check runs
  runs: {}, // stadium id -> { steps, shown } while a check's steps play back
  errors: {}, // stadium id -> last check error
  seeding: false,
  busy: {}, // document id -> true while confirming or removing
};

function apply(state) {
  Object.assign(intake, {
    stadiums: state.stadiums,
    elements: state.elements,
    documents: state.documents,
    checks: state.checks,
    loaded: true,
  });
}

// Pacing for the agent's visible progress; instant with reduced motion.
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

/** What the agent is doing with an uploaded file, in order. */
export const UPLOAD_STAGES = ["Uploading", "Reading the text", "Identifying the document"];

/** Load (or reload) everything. */
export function refreshIntake() {
  apply(localState());
  notify();
}

/** Load once per page load. */
export function ensureIntake() {
  if (!intake.loaded) refreshIntake();
}

let uploadSeq = 0;
/** Upload files two at a time; the agent reads each and proposes how to file it. */
export async function uploadFiles(files) {
  const queue = [...files].map((file) => ({ key: ++uploadSeq, name: file.name, file, error: null }));
  for (const item of queue) {
    if (item.file.size > MAX_UPLOAD) item.error = "Larger than 10 MB.";
    else if (!/\.(pdf|txt|md)$/i.test(item.name)) item.error = "Only PDF, TXT or Markdown.";
  }
  intake.uploads = [...intake.uploads, ...queue];
  notify();
  const send = async (item) => {
    const stage = (n) => {
      item.stage = n;
      notify();
    };
    try {
      stage(0);
      await wait(450);
      stage(1);
      const text = /\.(txt|md)$/i.test(item.name) ? await item.file.text() : null;
      await wait(650);
      stage(2);
      await wait(750);
      localUpload(item.file, text);
      intake.uploads = intake.uploads.filter((u) => u.key !== item.key);
      apply(localState());
    } catch (error) {
      item.error = error.message;
    }
    notify();
  };
  const pending = queue.filter((i) => !i.error);
  const workers = [0, 1].map(async () => {
    while (pending.length) await send(pending.shift());
  });
  await Promise.all(workers);
}

export function dismissUpload(key) {
  intake.uploads = intake.uploads.filter((u) => u.key !== key);
  notify();
}

async function withBusy(id, work) {
  intake.busy = { ...intake.busy, [id]: true };
  notify();
  try {
    await work();
  } finally {
    const { [id]: _done, ...rest } = intake.busy;
    intake.busy = rest;
    refreshIntake();
  }
}

/** The agent's assessment of a document with the given details (defaults to its own). */
export function assessment(doc, details = {}) {
  const filed = intake.documents.filter((d) => d.status === "filed");
  return assessDocument({ ...doc, ...details }, getAssessments(), filed);
}

/**
 * Confirm a document with the person's details: file it, record any evidence
 * it states against the register, raise the agent's alerts, and re-check the
 * stadium's progress claim when it is a progress report or plan.
 */
export const fileDocument = (id, details) =>
  withBusy(id, async () => {
    const doc = intake.documents.find((d) => d.document_id === id);
    const result = assessment(doc, details);
    if (result.blocker) return;
    localFile(id, details);
    const stadium = result.stadium;
    for (const m of result.matches)
      recordEvidence(stadium.id, m.requirement, {
        file: doc.name,
        value: String(m.value),
        note: `${details.evidenceType || "Evidence"} · ${m.stated}`,
      });
    addAlerts(
      result.alerts.map((a) => ({ ...a, source: "agent", stadiumId: stadium.id, stadiumName: stadium.name, document: doc.name })),
    );
    if (details.kind === "progress-report" || details.kind === "detailed-plan") {
      apply(localState());
      const hasReport = intake.documents.some(
        (d) => d.status === "filed" && !d.superseded && d.kind === "progress-report" && d.stadium_id === stadium.id,
      );
      if (hasReport) void runCheck(stadium.id);
    }
  });

/** Remove a document. */
export const removeDocument = (id) => withBusy(id, async () => localRemove(id));

/**
 * Recalculate one stadium's progress from its filed plans. The agent's steps
 * are shown one at a time (intake.runs) before the finding replaces the old one.
 */
export async function runCheck(stadiumId) {
  intake.running = { ...intake.running, [stadiumId]: true };
  const { [stadiumId]: _old, ...errors } = intake.errors;
  intake.errors = errors;
  const run = { steps: [], shown: 0 };
  intake.runs = { ...intake.runs, [stadiumId]: run };
  notify();
  try {
    await wait(600);
    const check = localCheck(stadiumId);
    run.steps = check.steps;
    notify();
    for (let i = 1; i <= run.steps.length; i++) {
      await wait(650);
      run.shown = i;
      notify();
    }
    await wait(500);
    intake.checks = { ...intake.checks, [stadiumId]: check };
    if (check.status === "overstated" || check.status === "evidence-missing") {
      const message =
        check.status === "overstated"
          ? `${check.stadium_name} reports ${check.claimed}% progress; its detailed plans support ${check.recalculated}%.`
          : `${check.stadium_name}'s progress claim cannot be fully checked: some reported packages have no plan on file.`;
      if (!getAlerts().some((a) => a.status === "open" && a.message === message))
        addAlerts([
          {
            source: "agent",
            severity: check.status === "overstated" ? "High" : "Medium",
            owner: PROGRAMME_OWNER,
            stadiumId,
            stadiumName: check.stadium_name,
            title: "Progress claim not supported",
            message,
          },
        ]);
    }
  } catch (error) {
    intake.errors = { ...intake.errors, [stadiumId]: error.message };
  } finally {
    const { [stadiumId]: _done, ...rest } = intake.running;
    const { [stadiumId]: _run, ...runs } = intake.runs;
    intake.running = rest;
    intake.runs = runs;
    notify();
  }
}

/** Check every stadium that has a progress report filed, one after another. onStart(id) runs before each. */
export async function runAllChecks(onStart) {
  for (const id of checkableStadiums().map((s) => s.id)) {
    onStart?.(id);
    await runCheck(id);
  }
}

/** A reviewer accepts or rejects the agent's finding. */
export function decideCheck(stadiumId, decision, note = "") {
  intake.checks = { ...intake.checks, [stadiumId]: localDecide(stadiumId, decision, note) };
  notify();
}

/** File and check the sample progress documents. */
export function seedIntake() {
  apply(localSeed());
  notify();
}

/** With the map's sample data: file and check the sample documents, unless some are already there. */
export async function loadSampleIntake() {
  ensureIntake();
  if (!intake.documents.length) seedIntake();
}

/** Remove every document, check and alert (part of Reset demo). */
export async function clearIntake() {
  localClear();
  clearAlerts();
  intake.uploads = [];
  intake.errors = {};
  if (intake.loaded) refreshIntake();
}

// ---------------------------------------------------------------- selectors

export const filedDocuments = () => intake.documents.filter((d) => d.status === "filed");
export const proposedDocuments = () => intake.documents.filter((d) => d.status === "proposed");

/** Stadiums with a current progress report on file. */
export function checkableStadiums() {
  const ids = new Set(
    filedDocuments()
      .filter((d) => d.kind === "progress-report" && !d.superseded)
      .map((d) => d.stadium_id),
  );
  return intake.stadiums.filter((s) => ids.has(s.id));
}

/** A finding a reviewer still has to decide on. */
export const needsDecision = (check) =>
  !!check && !check.decision && (check.status === "overstated" || check.status === "evidence-missing");

/** A document can be confirmed once the agent (or the person) has what it needs. */
export const proposalReady = (d) => !assessment(d).blocker;

export const CHECK_STATUS = {
  overstated: { label: "Overstated", tone: "bad" },
  "evidence-missing": { label: "Evidence missing", tone: "warn" },
  "behind-plan": { label: "Behind plan", tone: "warn" },
  supported: { label: "Supported", tone: "good" },
};

/** Document types offered when confirming (evidence types file as kind "evidence"). */
export const TYPE_OPTIONS = [
  ["progress-report", "Progress report"],
  ["detailed-plan", "Detailed plan"],
  ["evidence:Drawing", "Drawing"],
  ["evidence:Calculation", "Calculation"],
  ["evidence:Test record", "Test record"],
  ["evidence:Certificate", "Certificate"],
  ["other", "Other"],
];
export const typeValue = (d) => (d.kind === "evidence" ? `evidence:${d.evidenceType || "Drawing"}` : d.kind || "other");
export const typeLabel = (d) => TYPE_OPTIONS.find(([v]) => v === typeValue(d))?.[1] || "Other";
export const stadiumName = (id) => FACILITY_REGISTER.stadiums.find((s) => s.id === id)?.name || "";
