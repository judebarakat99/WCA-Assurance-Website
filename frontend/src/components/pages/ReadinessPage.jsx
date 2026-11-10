"use client";

import PageHead from "@/components/molecules/PageHead";
import ExecBrief from "@/components/organisms/ExecBrief";
import ForecastPanel from "@/components/organisms/ForecastPanel";
import ReadinessQuestions from "@/components/organisms/ReadinessQuestions";
import PageTemplate from "@/components/templates/PageTemplate";
import { forecasts } from "@/lib/domain/forecast";
import { worstForecast } from "@/lib/domain/readiness";

function Readiness({ S }) {
  const f = forecasts();
  return (
    <>
      <PageHead
        chip={`Readiness Room · ${f.length} venues · sample data`}
        title="Three signals that decide whether we make the next FIFA gate."
        lead="Answers come from validated evidence-based forecast."
      />
      <ExecBrief />
      <ForecastPanel S={S} forecasts={f} />
      <ReadinessQuestions forecasts={f} worst={worstForecast(f)} />
    </>
  );
}

export default function ReadinessPage() {
  return <PageTemplate label="Readiness Room">{(p) => <Readiness S={p.S} />}</PageTemplate>;
}
