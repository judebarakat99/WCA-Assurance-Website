"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DeliveryTimeline from "@/components/molecules/DeliveryTimeline";
import ViewToggle from "@/components/molecules/ViewToggle";
import AssuranceBriefing from "@/components/organisms/AssuranceBriefing";
import AssuranceMap from "@/components/organisms/AssuranceMap";
import ChangeImpactPanel from "@/components/organisms/ChangeImpactPanel";
import PillarRail from "@/components/organisms/PillarRail";
import PortfolioView from "@/components/organisms/PortfolioView";
import PageTemplate from "@/components/templates/PageTemplate";
import { assuranceMap } from "@/lib/domain/cityAssurance.mjs";
import { portfolio } from "@/lib/domain/portfolio.mjs";
import { changeImpact, withImpact } from "@/lib/domain/requirementChange.mjs";
import { scenarioById } from "@/lib/domain/requirementVersions.mjs";
import { reviewQueue } from "@/lib/domain/reviewQueue.mjs";
import { getAssessments, hasSampleAssessments } from "@/lib/store/assessments";
import { ensureIntake, intake } from "@/lib/store/intake";
import { updateMap } from "@/lib/store/state";

function ImpactLegend() {
  return (
    <div className="alegend" aria-label="Legend">
      <b>If the change is applied</b>
      <span>
        <i className="bad" /> compliant items reopen
      </span>
      <span>
        <i className="warn" /> evidence in review would fail
      </span>
      <span>
        <i className="good" /> still compliant
      </span>
      <span>
        <i className="mute" /> no evidence yet, or not affected
      </span>
      <span>
        <i className="badge">3</i> items reopened
      </span>
    </div>
  );
}

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
  const { city: selected, pillar, year, recenter, change, view, stadium } = ui.map;
  const records = getAssessments();
  // Progress checks (Evidence page) feed the portfolio's schedule and issues.
  useEffect(ensureIntake, []);
  // The view is mirrored in the address (?view=portfolio), so it survives a
  // reload and can be linked.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("view") === "portfolio" ? "portfolio" : "map";
    if (wanted !== ui.map.view) updateMap({ view: wanted });
    // Read once on arrival; later changes go through setView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setView = (next) => {
    updateMap({ view: next });
    router.replace(next === "portfolio" ? "/?view=portfolio" : "/", { scroll: false });
  };
  if (view === "portfolio")
    return (
      <div className="ahome">
        <PillarRail active={pillar} onChange={setPillar} />
        <div className="astage">
          <PortfolioView
            data={portfolio(records, intake.checks, pillar)}
            view={view}
            onView={setView}
            city={selected}
            onCity={(city) => updateMap({ city, stadium: null })}
            stadium={stadium}
            onStadium={(id) => updateMap({ stadium: id })}
            onShowOnMap={(r) => {
              updateMap({ city: r.cityId });
              setView("map");
            }}
          />
        </div>
      </div>
    );
  const base = assuranceMap(records, pillar, year);
  const scenario = scenarioById(change);
  const map = scenario ? withImpact(base, changeImpact(scenario, records), pillar) : base;
  const reopened = reviewQueue(records, { status: "reopened" }).length;
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
        {change ? (
          <ChangeImpactPanel view={map} onSelect={setSelected} />
        ) : (
          <AssuranceBriefing
            map={map}
            selected={selected}
            pillar={pillar}
            sample={hasSampleAssessments()}
            reopened={reopened}
            onSelect={setSelected}
          />
        )}
        <ViewToggle view={view} onChange={setView} className="amap-toggle" />
        {scenario ? <ImpactLegend /> : <Legend />}
        <div className="abottom">
          <button
            type="button"
            className="arecenter"
            onClick={() => updateMap({ city: null, recenter: recenter + 1 })}
          >
            Recenter
          </button>
        </div>
      </div>
    </div>
  );
}

/** Home for FIFA assurance: the map (host cities, pillars, briefing) or the national portfolio. */
export default function AssuranceHomePage() {
  return (
    <PageTemplate label="FIFA assurance map" wide>
      {({ ui }) => <AssuranceHome ui={ui} />}
    </PageTemplate>
  );
}
