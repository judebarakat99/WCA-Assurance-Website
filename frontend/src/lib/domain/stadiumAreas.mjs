// Critical areas: the stadium's physical areas, each carrying the FIFA register
// checks that concern it. An area's exposure is the worst status among its
// checks for one stadium, read from that stadium's assessments. Positions are in
// the 3D model's coordinates (metres; pitch centre at the origin, x along the
// pitch towards the north stand, z towards the east stand, y up).
import { stadiumRequirements } from "@/lib/domain/assessment.mjs";
import { CHAPTERS } from "@/lib/domain/fifa-catalogue.mjs";

/** Chapter colours (outline of an area pin, chapter legend). */
export const CHAPTER_COLOR = {
  "01": "#7c8cf8",
  "02": "#f0716b",
  "03": "#f2a65a",
  "04": "#59c07a",
  "05": "#4cc9c0",
  "06": "#5b8def",
  "07": "#e0a54a",
  "08": "#c47ef0",
  "09": "#f2d24b",
  "10": "#6fc3f0",
  "11": "#a3a8b8",
};

/** Exposure classes, worst first, with how each is read from the register. */
export const EXPOSURE = {
  critical: { label: "Critical", tone: "bad", rule: "a check found non-compliant" },
  material: { label: "Material", tone: "warn", rule: "evidence that fails its check" },
  manageable: { label: "Manageable", tone: "info", rule: "evidence awaiting a reviewer's decision" },
  controlled: { label: "Controlled", tone: "good", rule: "assessed checks all compliant" },
  none: { label: "Not assessed", tone: "mute", rule: "nothing assessed yet" },
};
const ORDER = ["critical", "material", "manageable", "controlled", "none"];

/** Areas of the stadium, the chapter they belong to, a 3D position and their checks. */
export const AREAS = [
  { id: "site", label: "Site and handover", chapter: "01", pos: [0, 1, 150], ids: ["ASS-0166", "ASS-0178", "ASS-0180", "ASS-0181", "STA-0002", "STA-0001", "STA-0005"] },
  { id: "capacity", label: "Capacity", chapter: "01", pos: [80, 22, 0], ids: ["STA-0003", "STA-0004", "STA-0006"] },
  { id: "water", label: "Water and drainage", chapter: "01", pos: [-150, 1, -30], ids: ["STA-0089", "STA-0090"] },
  { id: "safety", label: "Fire and life safety", chapter: "02", pos: [62, 24, 52], ids: ["ASS-0167", "ASS-0168", "ASS-0169", "STA-0056", "STA-0054", "ASS-0173", "ASS-0179"] },
  { id: "control", label: "Control room", chapter: "02", pos: [-46, 32, -62], ids: ["STA-0050", "STA-0061", "STA-0098", "STA-0051", "STA-0059", "STA-0052", "STA-0053"] },
  { id: "medical", label: "Medical", chapter: "02", pos: [0, 11, -58], ids: ["STA-0058", "STA-0038", "STA-0039", "STA-0032", "STA-0057"] },
  { id: "barriers", label: "Vehicle barriers", chapter: "02", pos: [150, 1, 110], ids: ["STA-0060", "STA-0047", "STA-0048", "STA-0049"] },
  { id: "gates", label: "Exit gates", chapter: "03", pos: [112, 1, 78], ids: ["STA-0011", "STA-0012", "STA-0010", "STA-0009", "STA-0013", "IBC-0163", "IBC-0162"] },
  { id: "pitch", label: "Pitch", chapter: "04", pos: [0, 1, 0], ids: ["STA-0018", "STA-0020", "STA-0019", "STA-0031", "ASS-0170", "STA-0021", "STA-0022", "STA-0023", "STA-0024", "STA-0025", "STA-0027", "STA-0026", "STA-0029"] },
  { id: "tunnel", label: "Tunnel and dressing rooms", chapter: "05", pos: [24, 4, -56], ids: ["STA-0036", "IBC-0158", "STA-0034", "STA-0035", "STA-0044", "STA-0030", "STA-0045", "STA-0028", "STA-0037", "STA-0046", "STA-0043"] },
  { id: "food", label: "Toilets, food", chapter: "06", pos: [-82, 18, 26], ids: ["STA-0014", "STA-0015", "STA-0016", "STA-0088"] },
  { id: "screens", label: "Screens and PA", chapter: "06", pos: [-78, 40, -30], ids: ["STA-0055", "STA-0093", "STA-0094"] },
  { id: "accessible", label: "Accessible", chapter: "06", pos: [0, 19, 67], ids: ["ASS-0172", "STA-0007", "STA-0008", "STA-0062"] },
  { id: "hospitality", label: "Hospitality", chapter: "07", pos: [-22, 26, -64], ids: ["STA-0082", "STA-0083", "STA-0080", "STA-0081", "STA-0078", "STA-0079", "STA-0084", "STA-0085"] },
  { id: "media", label: "Media", chapter: "08", pos: [20, 28, -66], ids: ["IBC-0160", "STA-0066", "STA-0072", "STA-0073", "STA-0040", "STA-0041", "STA-0042", "STA-0075", "STA-0076", "STA-0033", "STA-0074", "STA-0067"] },
  { id: "broadcast", label: "Cameras and compound", chapter: "08", pos: [-150, 1, -95], ids: ["ASS-0175", "STA-0063", "STA-0064", "STA-0065", "STA-0068", "STA-0069", "STA-0070"] },
  { id: "floodlights", label: "Floodlights", chapter: "09", pos: [-30, 49, 92], ids: ["ASS-0171", "STA-0095"] },
  { id: "power", label: "Power", chapter: "09", pos: [150, 1, -60], ids: ["ASS-0174", "STA-0086", "STA-0087", "STA-0099"] },
  { id: "ict", label: "ICT", chapter: "10", pos: [62, 12, -50], ids: ["STA-0071", "STA-0091", "ASS-0176", "STA-0077", "STA-0092", "STA-0096", "STA-0097"] },
  { id: "overlay", label: "Overlay", chapter: "11", pos: [-140, 1, 100], ids: ["IBC-0159", "STA-0017", "ASS-0177", "IBC-0161", "IBC-0164", "IBC-0165"] },
];

/** Overview fitting every area (Critical areas), and the twin's own starting view. */
export const AREAS_VIEW = { p: [95, 370, 410], t: [-25, 0, 10] };
export const DESIGN_VIEW = { p: [230, 170, 255], t: [0, 8, 0] };

/** A camera view looking at an area from outside the bowl. */
export function areaView(area) {
  const [x, y, z] = area.pos;
  const d = Math.hypot(x, z);
  if (d < 1) return { p: [10, 140, 90], t: [0, 0, 0] };
  return { p: [x + (x / d) * 95, y + 85, z + (z / d) * 95], t: area.pos };
}

const chapterById = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));

function classify(row, record) {
  const status = record?.status || "unassessed";
  if (status === "non-compliant") return "critical";
  if (status === "evidence-submitted") return record.evidence?.at(-1)?.check === "fail" ? "material" : "manageable";
  if (status === "compliant") return "controlled";
  return "none";
}

/**
 * Exposure of every area for one stadium. Returns { areas, counts, open }:
 * areas worst first, each { ...area, chapterInfo, color, exposure, checks:
 * [{ requirement, status, exposure }], open, assessed }.
 */
export function areaExposure(stadium, records) {
  const rows = Object.fromEntries(stadiumRequirements(stadium).map((r) => [r.requirement.id, r]));
  const areas = AREAS.map((area) => {
    const checks = area.ids
      .map((id) => rows[id])
      .filter(Boolean)
      .map((row) => {
        const record = records[row.key];
        return { requirement: row.requirement, status: record?.status || "unassessed", exposure: classify(row, record) };
      });
    const exposure = ORDER.find((k) => k !== "none" && checks.some((c) => c.exposure === k)) || "none";
    return {
      ...area,
      chapterInfo: chapterById[area.chapter],
      color: CHAPTER_COLOR[area.chapter],
      checks,
      exposure,
      open: checks.filter((c) => c.exposure === "critical" || c.exposure === "material").length,
      assessed: checks.filter((c) => c.exposure !== "none").length,
    };
  });
  areas.sort((a, b) => ORDER.indexOf(a.exposure) - ORDER.indexOf(b.exposure) || b.open - a.open || a.label.localeCompare(b.label));
  const counts = Object.fromEntries(ORDER.map((k) => [k, areas.filter((a) => a.exposure === k).length]));
  return { areas, counts, open: areas.reduce((t, a) => t + a.open, 0) };
}
