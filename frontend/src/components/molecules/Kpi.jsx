/** A large number with a short label underneath. tone: t-good | t-warn | t-bad (optional). */
export default function Kpi({ value, label, tone }) {
  return (
    <div className="kpi">
      <b className={tone || undefined}>{value}</b>
      <span>{label}</span>
    </div>
  );
}
