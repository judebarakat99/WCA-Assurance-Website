"use client";

import { useRouter } from "next/navigation";
import AskBar from "@/components/molecules/AskBar";
import DeliveryTimeline from "@/components/molecules/DeliveryTimeline";
import AssuranceBriefing from "@/components/organisms/AssuranceBriefing";
import AssuranceMap from "@/components/organisms/AssuranceMap";
import PillarRail from "@/components/organisms/PillarRail";
import PageTemplate from "@/components/templates/PageTemplate";
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { getAssessments, hasSampleAssessments } from "@/lib/store/assessments";
import { updateMap } from "@/lib/store/state";

function Legend() {
  return (
    <div className="alegend" aria-label="Legend">
      <b>Assured compliance</b>
      <span>
        <i className="good" /> 85% or more
      </span>
      <span>
        <i className="warn" /> 50–84%
      </span>
      <span>
        <i className="bad" /> below 50%
      </span>
      <span>
        <i className="mute" /> not reviewed yet
      </span>
      <span>
        <i className="badge">3</i> need attention
      </span>
      <span>
        <i className="ring" /> not due yet
      </span>
      <span>
        <i className="approx" /> approximate location
      </span>
    </div>
  );
}

// Map state lives in the shared ui store so the guided demo can drive it.
const setSelected = (city) => updateMap({ city });
const setPillar = (pillar) => updateMap({ pillar });
const setYear = (year) => updateMap({ year });

function AssuranceHome({ ui }) {
  const router = useRouter();
  const { city: selected, pillar, year, recenter } = ui.map;
  const map = assuranceMap(getAssessments(), pillar, year);
  return (
    <div className="ahome">
      <PillarRail active={pillar} onChange={setPillar} />
      <div className="astage">
        <AssuranceMap
          cities={map.cities}
          year={year}
          selected={selected}
          onSelect={setSelected}
          onOpenStadium={(id) => router.push(`/facilities/${id}`)}
          recenterSignal={recenter}
        />
        <DeliveryTimeline year={year} due={map.due} total={map.stadiumCount} onChange={setYear} />
        <AssuranceBriefing
          map={map}
          selected={selected}
          pillar={pillar}
          sample={hasSampleAssessments()}
          onSelect={setSelected}
        />
        <Legend />
        <div className="abottom">
          <button
            type="button"
            className="arecenter"
            onClick={() => updateMap({ city: null, recenter: recenter + 1 })}
          >
            Recenter
          </button>
          <AskBar />
        </div>
      </div>
    </div>
  );
}

/** Map-first home for FIFA assurance: host cities, pillars and the briefing. */
export default function AssuranceHomePage() {
  return (
    <PageTemplate label="FIFA assurance map" wide>
      {({ ui }) => <AssuranceHome ui={ui} />}
    </PageTemplate>
  );
}
