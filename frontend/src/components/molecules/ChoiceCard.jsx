/** One option in a radio group of cards: a title, a hint and an optional badge (for example "PDF"). */
export default function ChoiceCard({ checked, onClick, title, hint, badge }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={`rp-choice${checked ? " on" : ""}`}
      onClick={onClick}
    >
      {badge && <span className="rp-badge">{badge}</span>}
      <b>{title}</b>
      <span className="muted small">{hint}</span>
    </button>
  );
}
