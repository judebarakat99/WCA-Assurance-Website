"use client";

import StatusPill from "@/components/atoms/StatusPill";
import PageHead from "@/components/molecules/PageHead";
import { VENUES } from "@/lib/domain/data";
import {
  COMPLIANCE_AUTHORITIES,
  COMPLIANCE_GROUPS,
  complianceRecords,
  complianceProven,
} from "@/lib/domain/complianceData";
import { updateUi } from "@/lib/store/state";
import { openIntake } from "@/lib/navigation";
import { STATE_TONE } from "@/lib/ui/tones";

// Generated sample statuses: programme → authority/family → venue → requirement.
const rate = (list) =>
  list.length ? Math.round((list.filter((x) => complianceProven(x.status)).length / list.length) * 100) : 0;
const tone = (n) => (n >= 85 ? "good" : n >= 65 ? "warn" : "bad");
const provenCount = (list) => list.filter((x) => complianceProven(x.status)).length;

function drill(patch) {
  updateUi({ compliance: patch });
  window.scrollTo(0, 0);
}

function Meter({ value }) {
  return (
    <i className="comp-meter">
      <em className={tone(value)} style={{ width: `${value}%` }} />
    </i>
  );
}

function AuthorityCards({ all, selected }) {
  return (
    <div className="hero comp-authorities" aria-label="Compliance by authority">
      {COMPLIANCE_AUTHORITIES.map((a) => {
        const list = all.filter((x) => x.authority === a.id);
        const r = rate(list);
        return (
          <button
            key={a.id}
            type="button"
            className={`comp-authority ${selected === a.id ? "sel" : ""}`.trim()}
            aria-pressed={selected === a.id}
            onClick={() => drill({ authority: selected === a.id ? "all" : a.id, family: null, venue: null })}
          >
            <span>{a.name}</span>
            <b>{r}%</b>
            <small>
              {provenCount(list)}/{list.length} controls proven
            </small>
            <Meter value={r} />
            <p>{a.full}</p>
          </button>
        );
      })}
    </div>
  );
}

function VenueMatrix({ all, authority }) {
  return (
    <section className="comp-block">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">Venue compliance</span>
          <h3>All venues across all authorities</h3>
          <p>Click a venue to drill into every family and individual requirement.</p>
        </div>
      </div>
      <div className="comp-venue-grid">
        {VENUES.map((v) => {
          const list = all.filter((x) => x.venue === v.id);
          const r = rate(list);
          return (
            <button key={v.id} type="button" className="comp-venue" onClick={() => drill({ authority, family: null, venue: v.id })}>
              <div className="comp-venue-top">
                <div>
                  <b>{v.name}</b>
                  <small>
                    {v.city} · {v.type}
                  </small>
                </div>
                <strong className={tone(r)}>{r}%</strong>
              </div>
              <div className="comp-venue-auth">
                {COMPLIANCE_AUTHORITIES.map((a) => {
                  const ar = rate(list.filter((x) => x.authority === a.id));
                  return (
                    <span key={a.id}>
                      <small>{a.name}</small>
                      <b className={tone(ar)}>{ar}%</b>
                    </span>
                  );
                })}
              </div>
              <Meter value={r} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Families({ all, authority }) {
  return (
    <section className="comp-block">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">Requirement families</span>
          <h3>Compliance by authority and family</h3>
          <p>Four executive groups, eleven FIFA-aligned families and four authority lenses.</p>
        </div>
      </div>
      {COMPLIANCE_GROUPS.map((g) => (
        <section key={g.name} className="comp-group">
          <div className="comp-group-head">
            <span>{g.name}</span>
            <small>{g.families.length} families</small>
          </div>
          <div className="comp-families">
            {g.families.map((f) => {
              const list = all.filter((x) => x.family === f && (authority === "all" || x.authority === authority));
              const r = rate(list);
              return (
                <button key={f} type="button" className="comp-family" onClick={() => drill({ authority, family: f, venue: null })}>
                  <div>
                    <h3>{f}</h3>
                    <p>
                      {provenCount(list)}/{list.length} controls proven across programme
                    </p>
                  </div>
                  <div className={`comp-family-rate ${tone(r)}`}>{r}%</div>
                  <div className="comp-auth-bars">
                    {COMPLIANCE_AUTHORITIES.map((a) => {
                      const ar = rate(all.filter((x) => x.family === f && x.authority === a.id));
                      return (
                        <span key={a.id} title={a.full}>
                          <b>{a.name}</b>
                          <i>
                            <em className={tone(ar)} style={{ width: `${ar}%` }} />
                          </i>
                          <strong>{ar}%</strong>
                        </span>
                      );
                    })}
                  </div>
                  <span className="comp-arrow">View venues →</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

function BackLink({ authority, children }) {
  return (
    <button type="button" className="linkish" onClick={() => drill({ authority, family: null, venue: null })}>
      {children}
    </button>
  );
}

function AuthorityTiles({ items }) {
  return (
    <div className="comp-family-authorities">
      {items.map(({ a, r, note }) => (
        <div key={a.id} className="comp-fa">
          <span>{a.name}</span>
          <b className={tone(r)}>{r}%</b>
          <small>{note}</small>
        </div>
      ))}
    </div>
  );
}

function FamilyDrill({ all, family, authority }) {
  const group = COMPLIANCE_GROUPS.find((g) => g.families.includes(family));
  const rows = all.filter((x) => x.family === family);
  return (
    <>
      <div className="comp-drill-head">
        <BackLink authority={authority}>← Programme compliance</BackLink>
        <span>{group?.name || ""}</span>
        <h2>{family}</h2>
        <p>Compliance by authority across all seven venues.</p>
      </div>
      <AuthorityTiles
        items={COMPLIANCE_AUTHORITIES.map((a) => ({ a, r: rate(rows.filter((x) => x.authority === a.id)), note: a.full }))}
      />
      <div className="tablewrap comp-table">
        <table>
          <thead>
            <tr>
              <th>Venue</th>
              {COMPLIANCE_AUTHORITIES.map((a) => (
                <th key={a.id}>{a.name}</th>
              ))}
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {VENUES.map((v) => {
              const list = rows.filter((x) => x.venue === v.id);
              const r = rate(list);
              return (
                <tr key={v.id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => drill({ authority, family: null, venue: v.id })}>
                      {v.name}
                    </button>
                    <div className="muted">{v.city}</div>
                  </td>
                  {COMPLIANCE_AUTHORITIES.map((a) => {
                    const x = list.find((z) => z.authority === a.id);
                    return (
                      <td key={a.id}>
                        <StatusPill tone={STATE_TONE[x.status] || "mute"}>{x.status}</StatusPill>
                      </td>
                    );
                  })}
                  <td>
                    <b className={`comp-pct ${tone(r)}`}>{r}%</b>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VenueDrill({ all, venueId, authority }) {
  const v = VENUES.find((x) => x.id === venueId);
  const list = all.filter((x) => x.venue === venueId);
  return (
    <>
      <div className="comp-drill-head">
        <BackLink authority={authority}>← All venues</BackLink>
        <span>
          {v.city} · {v.type}
        </span>
        <h2>{v.name}</h2>
        <p>
          <b>{rate(list)}%</b> combined sample compliance across KSA, City, WCA and FIFA controls.
        </p>
      </div>
      <AuthorityTiles
        items={COMPLIANCE_AUTHORITIES.map((a) => {
          const rows = list.filter((x) => x.authority === a.id);
          return { a, r: rate(rows), note: `${provenCount(rows)}/${rows.length} proven` };
        })}
      />
      {COMPLIANCE_GROUPS.map((g, gi) => (
        <details key={g.name} className="comp-detail" open={gi === 0}>
          <summary>
            <div>
              <span>{g.name}</span>
              <small>{g.families.length} families</small>
            </div>
            <b>{rate(list.filter((x) => g.families.includes(x.family)))}%</b>
          </summary>
          <div className="comp-detail-body">
            {g.families.map((f) => (
              <section key={f}>
                <h3>{f}</h3>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Authority</th>
                        <th>Ref</th>
                        <th>Requirement</th>
                        <th>Source / basis</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPLIANCE_AUTHORITIES.map((a) => {
                        const x = list.find((z) => z.family === f && z.authority === a.id);
                        return (
                          <tr key={a.id}>
                            <td>
                              <b>{a.name}</b>
                            </td>
                            <td className="mono">{x.code}</td>
                            <td>{x.text}</td>
                            <td className="muted">{a.id === "CITY" ? `${x.source} · ${v.city}` : x.source}</td>
                            <td>
                              <StatusPill tone={STATE_TONE[x.status] || "mute"}>{x.status}</StatusPill>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </details>
      ))}
    </>
  );
}

const NOTICE = (
  <p className="criterion">
    Legacy simulation · These generated sample statuses are independent of the sourced FIFA library and evidence
    intake.
  </p>
);

/**
 * The legacy authority-based compliance dashboard and its drill-downs.
 * library: the server-rendered FIFA library, shown at programme level only.
 */
export default function LegacyCompliance({ ui, library }) {
  const all = complianceRecords(VENUES);
  const { authority, family, venue } = ui.compliance;
  if (venue)
    return (
      <>
        {NOTICE}
        <VenueDrill all={all} venueId={venue} authority={authority} />
      </>
    );
  if (family)
    return (
      <>
        {NOTICE}
        <FamilyDrill all={all} family={family} authority={authority} />
      </>
    );
  return (
    <>
      {library}
      {NOTICE}
      <PageHead
        chip={`Compliance · ${VENUES.length} venues · ${COMPLIANCE_AUTHORITIES.length} authorities`}
        title="Legacy sample compliance"
        lead="Start at programme level, compare compliance across the four authorities and requirement families, then drill into a family or venue. KSA examples are regulatory samples; WCA and City controls are illustrative PoC data and must be replaced by authoritative requirement libraries."
      />
      <div className="comp-actions">
        <div className="comp-overall">
          <span>Combined compliance</span>
          <b>{rate(all)}%</b>
          <small>
            {provenCount(all)}/{all.length} venue-controls proven
          </small>
        </div>
        <div className="spacer" />
        <button type="button" className="primary" onClick={() => openIntake("evidence")}>
          + Add new evidence
        </button>
        <button type="button" onClick={() => openIntake("requirement")}>
          + Add new requirement
        </button>
      </div>
      <AuthorityCards all={all} selected={authority} />
      <VenueMatrix all={all} authority={authority} />
      <Families all={all} authority={authority} />
    </>
  );
}
