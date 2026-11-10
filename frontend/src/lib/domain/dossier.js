// Plain-text inspection dossier for one venue (used by "Copy as text").
import { fmtD, pct, critText, showVal, venueMeta } from "@/lib/domain/data";
import { S } from "@/lib/store/state";
import { scores, oblsOf } from "@/lib/domain/scoring";

export function dossierText(venueId) {
  const m = venueMeta(venueId);
  const list = oblsOf(m.id);
  const sc = scores(list);
  const lines = list.map((o) => {
    const e = o.evidence[o.evidence.length - 1];
    const ev = e ? `${e.file} (${showVal(o, e.value)})` : "no evidence";
    return `${o.code} [${o.state}] ${o.text} | ${critText(o)} | ${ev}`;
  });
  return [
    `COMPLIANCE DOSSIER: ${m.name}, ${m.city} (sample data)`,
    `Generated ${fmtD(S.today)} · assured readiness ${pct(sc.assured)}%`,
    "",
    ...lines,
  ].join("\n");
}
