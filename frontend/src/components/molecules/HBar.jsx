/**
 * Labelled horizontal bar made of coloured segments.
 * segments: [{ n, k }] where k is a segment class (crit, late, good, oth).
 */
export default function HBar({ name, segments, total, max }) {
  return (
    <div className="hb">
      <span className="hb-l" title={name}>
        {name}
      </span>
      <div className="hb-tr">
        {segments
          .filter((s) => s.n > 0)
          .map((s) => (
            <i key={s.k} className={s.k} style={{ width: `${(s.n / max) * 100}%` }} />
          ))}
      </div>
      <b>{total}</b>
    </div>
  );
}
