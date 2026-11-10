"use client";

import ForecastChart from "@/components/organisms/ForecastChart";
import { fmtD, pct, sn } from "@/lib/domain/data";
import { resetScenario, setScenario } from "@/lib/domain/readiness";

const RATES = [
  [0.8, "Faster (+20%)"],
  [1, "As planned"],
  [1.25, "Slower (−20%)"],
];

function Scenario({ scn }) {
  const changed = scn.prod !== 1 || scn.fifa || scn.recovery.length > 0;
  return (
    <div className="scn" role="group" aria-label="Scenario">
      <b>Scenario</b>
      <label htmlFor="scProd">
        Delivery rate{" "}
        <select id="scProd" value={scn.prod} onChange={(e) => setScenario({ prod: Number(e.target.value) })}>
          {RATES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="scFifa">
        <input
          type="checkbox"
          id="scFifa"
          checked={scn.fifa}
          onChange={(e) => setScenario({ fifa: e.target.checked })}
        />{" "}
        FIFA changes requirements mid-programme
      </label>
      {scn.recovery.map((id) => (
        <span key={id} className="chipx">
          Recovery: {sn(id)}
          <button
            type="button"
            aria-label={`Remove recovery at ${sn(id)}`}
            onClick={() => setScenario({ recovery: scn.recovery.filter((x) => x !== id) })}
          >
            ×
          </button>
        </span>
      ))}
      {changed && (
        <button type="button" className="ghost" id="scReset" onClick={resetScenario}>
          Reset scenario
        </button>
      )}
    </div>
  );
}

function ForecastTable({ forecasts: f }) {
  return (
    <details className="fc-table">
      <summary>Show as table</summary>
      <div className="tablewrap mt-sm">
        <table>
          <thead>
            <tr>
              <th>Venue</th>
              <th>Gate</th>
              <th>FIFA milestone</th>
              <th>PMC finish</th>
              <th>P50</th>
              <th>P60</th>
              <th>P80</th>
              <th>On time</th>
            </tr>
          </thead>
          <tbody>
            {f.map((x) => (
              <tr key={x.id}>
                <td>{sn(x.id)}</td>
                <td>{x.gate.id}</td>
                <td className="mono">{fmtD(x.gateDate)}</td>
                <td className="mono">{fmtD(x.pmc.finish)}</td>
                <td className="mono">{fmtD(x.d50)}</td>
                <td className="mono">{fmtD(x.d60)}</td>
                <td className="mono">{fmtD(x.d80)}</td>
                <td>{pct(x.prob)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Question 1: the Monte Carlo gate forecast with scenario controls and a table view. */
export default function ForecastPanel({ S, forecasts }) {
  return (
    <section className="panel" id="fcPanel">
      <div className="eyebrow">✧ AI forecast · 1,000 simulated runs</div>
      <div className="qhead">
        <span className="qnum">1</span>
        <h3>Will we make our next FIFA gates, and how confident are we?</h3>
      </div>
      <p className="muted fc-intro">
        Each bar runs from P50 to P80: the dates by which the gate rules are met in 50% and 80% of 1,000 simulated runs.
        The runs start from what evidence has proven, not from reported percent complete. The hollow circle is the
        PMC&apos;s deterministic finish.
      </p>
      <Scenario scn={S.scn} />
      <ForecastChart forecasts={forecasts} today={S.today} recovery={S.scn.recovery} />
      <ForecastTable forecasts={forecasts} />
    </section>
  );
}
