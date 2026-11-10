import { GATES } from "@/lib/domain/data";

/** The five gates as a numbered track; index = current gate (0-based). */
export default function GateTrack({ index }) {
  return (
    <ol className="gtk">
      {GATES.map((g, i) => (
        <li key={g.id} className={i < index ? "done" : i === index ? "cur" : undefined}>
          <i>{i < index ? "✓" : i + 1}</i>
          <b>{g.id}</b>
          <span>{g.name}</span>
        </li>
      ))}
    </ol>
  );
}
