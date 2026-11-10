import { GATES } from "@/lib/domain/data";

/** Five dots showing gate progress; index = current gate (0-based). */
export default function GateDots({ index }) {
  return (
    <span
      className="gdots"
      role="img"
      aria-label={`Gate ${Math.min(index + 1, GATES.length)} of ${GATES.length}`}
    >
      {GATES.map((g, i) => (
        <i
          key={g.id}
          className={i < index ? "done" : i === index ? "cur" : undefined}
          title={`${g.id} ${g.name}`}
        />
      ))}
    </span>
  );
}
