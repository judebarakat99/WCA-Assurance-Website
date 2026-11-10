import { LEVELS } from "@/lib/domain/data";
import { LEVEL_COLOR } from "@/lib/ui/tones";

/** Open corrective actions counted per escalation level. */
export default function EscalationLadder({ openIssues }) {
  const counts = LEVELS.map((_, l) => openIssues.filter((i) => i.level === l).length);
  const max = Math.max(1, ...counts);
  return (
    <div className="ladder">
      {LEVELS.map((label, i) => (
        <div key={label} className="rung">
          <div className="lv">Level {i + 1}</div>
          <div className="ct">{counts[i]}</div>
          <div className="rung-name">{label}</div>
          <div className="mb-tr">
            <i style={{ width: `${(counts[i] / max) * 100}%`, background: LEVEL_COLOR[i] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
