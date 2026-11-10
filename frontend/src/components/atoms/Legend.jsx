/** Colour key for a chart. parts: [{ n, c, l }]; empty parts are hidden. */
export default function Legend({ parts }) {
  return (
    <div className="leg">
      {parts
        .filter((p) => p.n > 0)
        .map((p) => (
          <span key={p.l}>
            <i style={{ background: p.c }} />
            {p.n} {p.l}
          </span>
        ))}
    </div>
  );
}
