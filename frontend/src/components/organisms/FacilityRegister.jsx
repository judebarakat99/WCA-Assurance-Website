// Server Component: the programme's facilities as declared in the bid, with the
// FIFA capacity requirement that applies to each stadium.
import StatusPill from "@/components/atoms/StatusPill";
import { fmtN } from "@/lib/domain/data";
import {
  FACILITY_REGISTER,
  MATCH_LABEL,
  STATUS_LABEL,
  cityRecords,
  registerSource,
  registerSummary,
} from "@/lib/domain/facilities.mjs";

const STATUS_TONE = { "existing-refurbishment": "info", "under-construction": "warn", planned: "mute" };

function SourceNote() {
  const s = registerSource("alrajhi-wc2034-economy-2024-12");
  return (
    <p className="muted small">
      <StatusPill tone="warn">Secondary source</StatusPill>{" "}
      <a href={s.url} target="_blank" rel="noopener noreferrer">
        {s.publisher}, {s.published}
      </a>{" "}
      · {s.basis} {s.limitations}
    </p>
  );
}

function Summary() {
  const s = registerSummary();
  const tiles = [
    [s.stadiums, "stadiums"],
    [s.cities, "host cities"],
    [fmtN(s.seats), "seats (gross)"],
    [fmtN(s.roomKeys), "room keys planned"],
    [s.byStatus["existing-refurbishment"], "refurbishments"],
    [s.byStatus["under-construction"], "under construction"],
    [s.byStatus.planned, "planned new builds"],
    [s.lastCompletion, "last stadium due"],
  ];
  return (
    <>
      <div className="mini-grid four mt">
        {tiles.map(([n, label]) => (
          <div key={label} className="mini">
            <b>{n}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted small">
        Other assets ·{" "}
        {s.otherAssets
          .map((a) => `${a.total} ${a.assetType.toLowerCase()}s${a.existing ? ` (${a.existing} existing, ${a.planned} planned)` : ""}`)
          .join(" · ")}
        . No per-site list yet.
      </p>
    </>
  );
}

function CapacityCheck({ check }) {
  if (!check) return <span className="muted">No capacity rule</span>;
  const meets = check.status === "declared-meets";
  return (
    <>
      <StatusPill tone={meets ? "info" : "bad"}>
        {meets ? "Declared meets" : "Declared short"} · {check.margin >= 0 ? "+" : ""}
        {fmtN(check.margin)}
      </StatusPill>
      <div className="muted fine">Evidence pending</div>
    </>
  );
}

function CityTable({ city }) {
  return (
    <details className="comp-detail" open={city.id === "riyadh"}>
      <summary>
        <div>
          <span>{city.name}</span>
          <small>
            {city.stadiums.length} {city.stadiums.length === 1 ? "stadium" : "stadiums"} · {fmtN(city.seats)} seats ·{" "}
            {fmtN(city.roomKeys)} room keys
          </small>
        </div>
        <b>
          {city.declaredMeets}/{city.stadiums.length}
        </b>
      </summary>
      <div className="comp-detail-body tablewrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Stadium</th>
              <th scope="col">Gross capacity</th>
              <th scope="col">Status</th>
              <th scope="col">Highest match</th>
              <th scope="col">FIFA requirement</th>
              <th scope="col">Declared check</th>
            </tr>
          </thead>
          <tbody>
            {city.stadiums.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.name}
                  {s.capacityNote && <div className="muted fine">{s.capacityNote}</div>}
                </td>
                <td className="mono">{fmtN(s.grossCapacity)}</td>
                <td>
                  <StatusPill tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</StatusPill>
                  <div className="muted fine">Complete {s.completionYear}</div>
                </td>
                <td>{MATCH_LABEL[s.highestMatch]}</td>
                <td>
                  {s.capacity ? (
                    <>
                      <span className="mono">{s.capacity.requirement.id}</span>
                      <div className="muted fine">≥ {fmtN(s.capacity.minimum)} seats</div>
                    </>
                  ) : (
                    "–"
                  )}
                </td>
                <td>
                  <CapacityCheck check={s.capacity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Facility register: 15 stadiums across 5 host cities, with declared capacity checks. */
export default function FacilityRegister() {
  const cities = cityRecords();
  return (
    <section className="comp-block" aria-labelledby="facility-register-title">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">Facility register</span>
          <h2 id="facility-register-title">Stadiums and host cities</h2>
          <p>
            Reviewed {FACILITY_REGISTER.reviewedOn} · {FACILITY_REGISTER.scopeNote}
          </p>
        </div>
      </div>
      <SourceNote />
      <Summary />
      <p className="muted small">
        Each stadium&apos;s highest match selects its FIFA capacity requirement. The check compares the declared capacity
        with that minimum; it becomes an assessment only when evidence (seating plan and match allocation) is reviewed.
      </p>
      {cities.map((city) => (
        <CityTable key={city.id} city={city} />
      ))}
    </section>
  );
}
