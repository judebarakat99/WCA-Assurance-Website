// Server Component: the programme's facilities as declared in the bid, with the
// FIFA capacity requirement that applies to each stadium.
import Link from "next/link";
import StatusPill from "@/components/atoms/StatusPill";
import { fmtN } from "@/lib/format";
import { MATCH_LABEL, STATUS_LABEL, cityRecords } from "@/lib/domain/facilities.mjs";

const STATUS_TONE = { "existing-refurbishment": "info", "under-construction": "warn", planned: "mute" };

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
    <details className="comp-detail">
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
                  <Link href={`/facilities/${s.id}`}>{s.name}</Link>
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
        </div>
      </div>
      <p className="muted small">
        Open a stadium to see every FIFA requirement that applies to it and record evidence. Each stadium&apos;s highest match selects its FIFA capacity requirement. The check compares the declared capacity
        with that minimum; it becomes an assessment only when evidence (seating plan and match allocation) is reviewed.
      </p>
      {cities.map((city) => (
        <CityTable key={city.id} city={city} />
      ))}
    </section>
  );
}
