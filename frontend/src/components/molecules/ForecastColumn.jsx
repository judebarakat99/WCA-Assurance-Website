import Meter from "@/components/atoms/Meter";
import StatusPill from "@/components/atoms/StatusPill";
import { pct, fmtD, dd } from "@/lib/domain/data";
import { probTone } from "@/lib/ui/tones";

/** One side of a before/after forecast comparison. */
export default function ForecastColumn({ label, prob, d80, late, highlight = false }) {
  return (
    <div className={`vs-col ${highlight ? "hl" : ""}`.trim()}>
      <div className="vs-l">{label}</div>
      <div className="vs-n">
        {pct(prob)}
        <small>%</small>
      </div>
      <Meter value={pct(prob)} tone={probTone(prob)} />
      <div className="vs-d">P80 {fmtD(d80)}</div>
      <StatusPill tone={late > 0 ? "bad" : "good"}>
        {late > 0 ? `${dd(late)} late` : "inside milestone"}
      </StatusPill>
    </div>
  );
}
