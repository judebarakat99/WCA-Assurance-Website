/**
 * Summary tile: label, big value, a visual (bar, segments) and a footnote.
 * tone: "warn" | "alert" (optional) tints the border.
 */
export default function KpiTile({ label, value, visual, note, tone }) {
  return (
    <div className={`tile ${tone || ""}`.trim()}>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {visual}
      <div className="n">{note}</div>
    </div>
  );
}
