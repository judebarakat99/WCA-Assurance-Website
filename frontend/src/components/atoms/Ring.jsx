// conic-gradient stops for the parts, in order: "colour start% end%".
function gradientStops(parts) {
  const visible = parts.filter((p) => p.n > 0);
  const total = visible.reduce((a, p) => a + p.n, 0) || 1;
  const stops = [];
  let acc = 0;
  for (const p of visible) {
    const start = (acc / total) * 100;
    acc += p.n;
    stops.push(`${p.c} ${start}% ${(acc / total) * 100}%`);
  }
  return stops.join(",");
}

/**
 * Donut chart with a value in the middle.
 * parts: [{ n, c }] (count and colour); size: "sm" | "lg" (optional).
 */
export default function Ring({ parts, value, label, size }) {
  const stops = gradientStops(parts);
  return (
    <div
      className={`ring ${size || ""}`.trim()}
      style={{ background: `conic-gradient(${stops || "var(--sunk) 0 100%"})` }}
    >
      <div className="ring-in">
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
