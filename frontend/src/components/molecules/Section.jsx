/** A titled page section: eyebrow, heading, optional aside (legend, actions), then content. */
export default function Section({ eyebrow, title, aside, id, children }) {
  return (
    <section className="block" id={id}>
      <div className="block-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h3>{title}</h3>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
