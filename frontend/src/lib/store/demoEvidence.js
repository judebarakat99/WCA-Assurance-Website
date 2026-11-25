// Volatile evidence demo state. Intentionally not persisted: a hard refresh clears it.
let demoEvidence = null;
const listeners = new Set();

export function setDemoEvidence(value) {
  demoEvidence = value;
  listeners.forEach((listener) => listener(demoEvidence));
}

export function getDemoEvidence() {
  return demoEvidence;
}

export function subscribeDemoEvidence(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
