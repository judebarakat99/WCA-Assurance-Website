// Shared look for exported reports (hex colours without "#").
export const NAVY = "2E3569";
export const INK = "1D2433";
export const MUTED = "667085";
export const LINE = "D0D5DD";
export const BAND = "F5F6FA";

/** Text and fill colour per tone. */
export const TONE = {
  bad: { text: "B42318", fill: "FDECEA" },
  warn: { text: "B54708", fill: "FEF4E6" },
  good: { text: "067647", fill: "E7F6EC" },
  mute: { text: "667085", fill: "F2F4F7" },
};

export const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Start a browser download for a Blob. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
