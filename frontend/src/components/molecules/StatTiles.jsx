/**
 * A row of headline figures. tiles: [{ value, label, tone? }] (tone: good | warn | bad).
 * columns: "four" (default) or "eight".
 */
export default function StatTiles({ tiles, columns = "four", className = "" }) {
  return (
    <div className={`mini-grid ${columns} ${className}`.trim()}>
      {tiles.map((t) => (
        <div key={t.label} className={`mini ${t.tone || ""}`.trim()}>
          <b>{t.value}</b>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}
