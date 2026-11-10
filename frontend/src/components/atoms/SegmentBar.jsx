/** Stacked horizontal bar. parts: [{ n, c, l }] (count, colour, label). */
export default function SegmentBar({ parts }) {
  const total = parts.reduce((a, p) => a + p.n, 0) || 1;
  return (
    <div className="segbar">
      {parts
        .filter((p) => p.n > 0)
        .map((p) => (
          <i
            key={p.l}
            style={{ width: `${(p.n / total) * 100}%`, background: p.c }}
            title={`${p.n} ${p.l}`}
          />
        ))}
    </div>
  );
}
