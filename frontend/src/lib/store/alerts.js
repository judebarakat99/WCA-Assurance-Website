// Alerts to requirement owners, kept in this browser: raised by the Evidence
// agent when a confirmed document shows a gap, and by applied requirement changes.
import { notify } from "@/lib/store/state";

const KEY = "wca-alerts-v1";
let alerts = null;

function load() {
  try {
    alerts = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    alerts = [];
  }
  if (!Array.isArray(alerts)) alerts = [];
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(alerts));
  } catch {
    // Storage unavailable: keep them for this page load.
  }
}

/** All alerts, newest first. */
export function getAlerts() {
  if (!alerts) load();
  return alerts;
}

let seq = 0;
/**
 * Add alerts. Each: { source: "agent" | "change", severity, owner, message,
 * stadiumId?, stadiumName?, requirementId?, title?, document? }.
 */
export function addAlerts(list) {
  if (!list.length) return;
  const at = new Date().toISOString().slice(0, 10);
  getAlerts().unshift(...list.map((a) => ({ id: `${Date.now()}-${++seq}`, at, status: "open", ...a })));
  save();
  notify();
}

/** Mark an alert resolved (or open again). */
export function setAlertStatus(id, status) {
  const a = getAlerts().find((x) => x.id === id);
  if (a) {
    a.status = status;
    save();
    notify();
  }
}

export function clearAlerts() {
  alerts = [];
  save();
  notify();
}

export const openAlerts = () => getAlerts().filter((a) => a.status === "open");
