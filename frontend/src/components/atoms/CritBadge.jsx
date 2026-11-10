/** Criticality marker: Critical | High | Medium. */
export default function CritBadge({ level }) {
  return (
    <span className={`crit c-${level}`}>
      <i />
      {level}
    </span>
  );
}
