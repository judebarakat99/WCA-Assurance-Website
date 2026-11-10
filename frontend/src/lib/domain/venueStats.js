// Per-venue readiness summary used by the overview map, chips and briefs.
import { S } from "@/lib/store/state";
import { scores, oblsOf, gateEval } from "@/lib/domain/scoring";
import { forecasts } from "@/lib/domain/forecast";
import { toneOf } from "@/lib/ui/tones";

export function venueStats(id) {
  const list = oblsOf(id);
  const sc = scores(list);
  const f = forecasts().find((x) => x.id === id);
  const open = S.issues.filter((i) => i.status === "Open" && list.some((o) => o.id === i.obl));
  return {
    list,
    sc,
    f,
    open,
    crit: open.filter((i) => i.crit === "Critical").length,
    criticalUnverified: list.filter((o) => o.crit === "Critical" && o.state !== "Verified").length,
    gate: gateEval(id),
    tone: f ? toneOf(f.cls) : "good",
  };
}
