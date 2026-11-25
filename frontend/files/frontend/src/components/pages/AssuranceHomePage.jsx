"use client";

import { useEffect, useState } from "react";
import OverviewKpis from "@/components/organisms/OverviewKpis";
import OverviewMap from "@/components/organisms/OverviewMap";
import OverviewPortfolio from "@/components/organisms/OverviewPortfolio";
import OverviewRail from "@/components/organisms/OverviewRail";
import OverviewSide from "@/components/organisms/OverviewSide";
import PageTemplate from "@/components/templates/PageTemplate";
import { PILLARS } from "@/lib/domain/cityAssurance.mjs";
import { overviewModel } from "@/lib/overview/model.mjs";
import { getAssessments } from "@/lib/store/assessments";
import { updateMap } from "@/lib/store/state";

// The stadium shown first: the one with the 3D design review.
const DEFAULT_STADIUM = "king-salman-international";

// Map state lives in the shared ui store so the guided demo can drive it.
const setPillar = (pillar) => updateMap({ pillar });
const setCity = (city) => updateMap({ city });

function Overview({ ui }) {
  const { city: focusCity, pillar } = ui.map;
  // The system date is read after the page has mounted, so the server and the browser render the same first frame.
  const [now, setNow] = useState(null);
  useEffect(() => setNow(new Date()), []);
  const [picked, setPicked] = useState(null);
  const [bucket, setBucket] = useState(null);
  const [hoverId, setHoverId] = useState(null);

  const model = overviewModel({ records: getAssessments(), pillar, now });
  const rows = model.rows;
  const selected = rows.find((r) => r.id === picked) || rows.find((r) => r.id === DEFAULT_STADIUM) || rows[0] || null;
  const chapter = pillar ? PILLARS.find((p) => p.id === pillar)?.label.replace(" · ", " ") || pillar : null;

  const select = (id) => {
    const r = rows.find((x) => x.id === id);
    setPicked(id);
    if (r) setCity(r.cityId); // opening a stadium zooms the map to its host city
    setBucket(null);
  };

  return (
    <div className="ov">
      <h1 className="sr-only">Overview</h1>
      <OverviewKpis kpis={model.kpis} chapter={chapter} />
      <div className="ov-panel">
        <OverviewRail active={pillar} onChange={setPillar} />
        <OverviewPortfolio rows={rows} selectedId={selected?.id} hoverId={hoverId} onSelect={select} onHover={setHoverId} chapter={chapter} />
        <section className="ov-mapcol" aria-labelledby="ov-map-title">
          <h2 id="ov-map-title" className="ov-h">
            Map navigation
          </h2>
          <OverviewMap
            rows={rows}
            selectedId={selected?.id}
            hoverId={hoverId}
            focusCity={focusCity}
            onSelect={(id) => {
              setPicked(id);
              setBucket(null);
            }}
            onHover={setHoverId}
            onFocusCity={setCity}
          />
          <p className="ov-caption">Click a pin or portfolio row to open the same stadium view.</p>
        </section>
        <OverviewSide row={selected} bucket={bucket} onBucket={setBucket} chapter={chapter} />
      </div>
    </div>
  );
}

/** The landing page: four headline figures, the stadium portfolio, a map and the exposure of the stadium that is open. */
export default function AssuranceHomePage() {
  return (
    <PageTemplate label="Overview" wide>
      {({ ui }) => <Overview ui={ui} />}
    </PageTemplate>
  );
}
