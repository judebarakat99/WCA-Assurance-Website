// Alerts for the owners of requirements. Two kinds, shown together:
//  - alerts the evidence agent raised from a document it read (kept in this browser);
//  - findings the agent flags from the register itself: every critical finding that no document alert already
//    covers, so every critical finding on the overview and on each stadium page has an alert for its owner.
// An owner acknowledges an alert; the acknowledgement is kept with it.
import { FACILITY_REGISTER } from "@/lib/domain/facilities.mjs";
import { stadiumExposure } from "@/lib/domain/exposure.mjs";
import { mitigationAction, ownerFor } from "@/lib/domain/mitigation.mjs";
import { notify } from "@/lib/store/state";
import { clearCustom } from "@/lib/watch/custom";
import { clearSiteConditions } from "@/lib/domain/siteConditions.mjs";

const KEY = "wca-alerts-v1";

export const SEVERITY = {
  high: { label: "High", tone: "bad", days: 7 },
  medium: { label: "Medium", tone: "warn", days: 14 },
  low: { label: "Low", tone: "info", days: 30 },
};
export const KIND_LABEL = {
  "requirement-change": "Requirement change",
  "below-criterion": "Below the criterion",
  inconsistency: "Inconsistent",
  "missing-evidence": "Missing evidence",
  finding: "Critical finding",
};

let list = null; // stored alerts, and the acknowledgements of derived ones
let seq = 0;

const today = () => new Date().toISOString().slice(0, 10);
function plusDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function load() {
  if (list) return list;
  try {
    list = JSON.parse(localStorage.getItem(KEY));
  } catch {
    list = null;
  }
  if (!Array.isArray(list)) list = [];
  return list;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Private mode or full storage: keep working for this page load.
  }
}

/** Alerts raised from documents, newest first. */
export const getAlerts = () => load().filter((a) => !a.derived);

/** Raise the alerts the agent prepared for one document. source: { id, name, stadium_id } */
export function raiseAlerts(items, source) {
  const day = today();
  const rows = (items || []).map((a) => ({
    id: `al-${Date.now().toString(36)}-${++seq}`,
    derived: false,
    source: { type: source.type || "document", id: source.id, name: source.name },
    stadium_id: source.stadium_id,
    requirement_id: a.requirement_id || null,
    owner: a.owner,
    severity: a.severity,
    kind: a.kind,
    title: a.title,
    detail: a.detail,
    action: a.action,
    raised_on: day,
    due: plusDays(day, SEVERITY[a.severity]?.days ?? 14),
    status: "open",
    acknowledged_on: null,
  }));
  if (!rows.length) return rows;
  load().unshift(...rows);
  save();
  notify();
  return rows;
}

/** An owner acknowledges an alert (or takes the acknowledgement back). */
export function setAcknowledged(id, acknowledged) {
  const all = load();
  let row = all.find((a) => a.id === id);
  if (!row) {
    row = { id, derived: true };
    all.push(row);
  }
  row.status = acknowledged ? "acknowledged" : "open";
  row.acknowledged_on = acknowledged ? today() : null;
  save();
  notify();
}

/** Point a document's alerts at another stadium (when the person corrects the stadium before filing). */
export function retargetAlerts(documentId, stadiumId) {
  let changed = false;
  for (const a of load()) {
    if (a.source?.id === documentId && a.stadium_id !== stadiumId) {
      a.stadium_id = stadiumId;
      changed = true;
    }
  }
  if (changed) {
    save();
    notify();
  }
}

/** Withdraw the alerts a document raised (when it is removed from intake). */
export function removeAlertsFor(documentId) {
  const all = load();
  const keep = all.filter((a) => a.source?.id !== documentId);
  if (keep.length !== all.length) {
    list = keep;
    save();
    notify();
  }
}

/** Remove every alert (Reset demo). */
export function clearAlerts() {
  list = [];
  save();
  clearCustom();
  clearSiteConditions();
}

/** The critical findings in the register, as alerts for their owners. */
function findingAlerts(records) {
  const acknowledged = new Map(load().filter((a) => a.derived).map((a) => [a.id, a]));
  const out = [];
  for (const stadium of FACILITY_REGISTER.stadiums) {
    for (const finding of stadiumExposure(stadium, records).findings) {
      if (finding.level !== "critical") continue;
      const req = finding.row.requirement;
      const id = `finding::${stadium.id}::${req.id}`;
      const ack = acknowledged.get(id);
      const latest = finding.record?.evidence?.at(-1);
      out.push({
        id,
        derived: true,
        source: { type: "register", name: "Register scan" },
        stadium_id: stadium.id,
        requirement_id: req.id,
        owner: ownerFor(stadium.id, req),
        severity: "high",
        kind: "finding",
        title: `${req.title} is ${finding.record?.partial ? "only partly met" : "not met"} at ${stadium.name}`,
        detail: finding.reason,
        action: mitigationAction(finding),
        raised_on: finding.record?.review?.on || latest?.on || today(),
        due: plusDays(today(), SEVERITY.high.days),
        status: ack?.status || "open",
        acknowledged_on: ack?.acknowledged_on || null,
      });
    }
  }
  return out;
}

const RANK = { high: 0, medium: 1, low: 2 };

/** Every alert, open ones first, then by severity and due date. */
export function allAlerts(records) {
  const stored = getAlerts();
  // A document's alert is more specific than the register scan's finding for the same requirement: show one.
  const covered = new Set(stored.filter((a) => a.requirement_id).map((a) => `${a.stadium_id}::${a.requirement_id}`));
  const findings = findingAlerts(records).filter((a) => !covered.has(`${a.stadium_id}::${a.requirement_id}`));
  return [...stored, ...findings].sort(
    (a, b) =>
      (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) ||
      RANK[a.severity] - RANK[b.severity] ||
      a.due.localeCompare(b.due) ||
      b.raised_on.localeCompare(a.raised_on),
  );
}

export const openAlerts = (records) => allAlerts(records).filter((a) => a.status === "open");
