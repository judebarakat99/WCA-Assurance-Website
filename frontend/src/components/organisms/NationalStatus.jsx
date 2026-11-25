"use client";

import Link from "next/link";
import StatusPill from "@/components/atoms/StatusPill";
import { EXPOSURE, EXPOSURE_ORDER, portfolio } from "@/lib/domain/exposure.mjs";
import { fmtN, pct } from "@/lib/format";
import { getAssessments } from "@/lib/store/assessments";

function Tile({ value, label, sub, tone = "", href }) {
  const body = (
    <>
      <b>{value}</b>
      <span>
        {label}
        {sub && (
          <>
            <br />
            {sub}
          </>
        )}
      </span>
    </>
  );
  const className = `mini ${tone}`.trim();
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Exposure({ counts }) {
  return (
    <span className="nat-xs">
      {EXPOSURE_ORDER.map((key) => (
        <span
          key={key}
          className={`nat-x ${EXPOSURE[key].tone}${counts[key] ? "" : " zero"}`}
          title={`${EXPOSURE[key].label}: ${counts[key]}`}
          aria-label={`${EXPOSURE[key].label}: ${counts[key]}`}
        >
          {counts[key]}
        </span>
      ))}
    </span>
  );
}

/** National programme status first: KPIs and the stadium portfolio, worst first. The map follows as navigation. */
export default function NationalStatus() {
  const { rows, kpis: k } = portfolio(getAssessments());
  const complianceTone = k.compliance >= 0.85 ? "good" : k.compliance >= 0.5 ? "warn" : "bad";
  return (
    <>
      <section className="nat" aria-labelledby="nat-title">
        <div>
          <span className="eyebrow">National overview · Saudi Arabia 2034</span>
          <h2 id="nat-title">Where does intervention need to happen now?</h2>
          <p className="nat-lead">
            {k.criticalIssues} critical and {k.materialIssues} material findings are open across {k.atRisk} of{" "}
            {k.stadiums} stadiums. Select a stadium to open its assessment.
          </p>
        </div>

        <div className="mini-grid four">
          <Tile
            value={`${pct(k.compliance)}%`}
            label="National compliance"
            sub={`${fmtN(k.compliant)} of ${fmtN(k.inScope)} requirements accepted`}
            tone={complianceTone}
          />
          <Tile
            value={`${k.atRisk} of ${k.stadiums}`}
            label="Stadiums at risk"
            sub={`${k.offTrack} off track · ${k.atRiskOnly} at risk`}
            tone={k.offTrack ? "bad" : k.atRisk ? "warn" : "good"}
          />
          <Tile
            value={k.criticalIssues}
            label="Critical issues"
            sub={`${k.materialIssues} material`}
            tone={k.criticalIssues ? "bad" : "good"}
          />
          <Tile
            value={k.awaitingReview}
            label="Awaiting your review"
            sub="Open the review queue"
            tone={k.awaitingReview ? "warn" : "good"}
            href="/review"
          />
        </div>

        <div className="tablewrap">
          <table>
            <caption className="sr-only">Stadium portfolio, highest exposure first</caption>
            <thead>
              <tr>
                <th scope="col">Stadium</th>
                <th scope="col">Assured</th>
                <th scope="col">Schedule</th>
                <th scope="col">Issues</th>
                <th scope="col">Exposure</th>
                <th scope="col">Next gate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stadium.id}>
                  <td>
                    <Link href={`/facilities/${r.stadium.id}`}>{r.stadium.name}</Link>
                    <small>
                      {r.cityName} · due {r.stadium.completionYear}
                    </small>
                  </td>
                  <td className="mono">{pct(r.assured)}%</td>
                  <td>
                    <StatusPill tone={r.schedule.tone}>{r.schedule.label}</StatusPill>
                  </td>
                  <td className="mono">{r.issues}</td>
                  <td>
                    <Exposure counts={r.counts} />
                  </td>
                  <td>{r.gate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="nat-key" aria-label="Mitigation exposure">
          {EXPOSURE_ORDER.map((key) => (
            <div key={key}>
              <span className={`nat-x ${EXPOSURE[key].tone}`}>{EXPOSURE[key].label}</span>
              <span>{EXPOSURE[key].definition}</span>
            </div>
          ))}
        </div>
      </section>
      <p className="nat-map">Map navigation: select a host city or a stadium.</p>
    </>
  );
}
