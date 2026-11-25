// Server Component: the FIFA venue requirements register, by chapter, rendered at build time.
import StatusPill from "@/components/atoms/StatusPill";
import { CHAPTERS, FIFA_CATALOGUE, criterionLabel, fifaRequirementRecords } from "@/lib/domain/fifa-catalogue.mjs";

const SITE_ORDER = ["Stadium", "Training site", "Fan festival", "IBC"];

function Requirements({ records }) {
  return (
    <div className="tablewrap">
      <table className="fifa-reqs">
        <thead>
          <tr>
            <th>ID</th>
            <th>Requirement</th>
            <th>Criterion</th>
            <th>Applies to</th>
            <th>Section</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td className="mono small">{r.id === "FAN-UNREADABLE" ? "–" : r.id}</td>
              <td>
                <b>{r.title}</b>
                {r.transcriptionNote && <div className="muted fine">{r.transcriptionNote}</div>}
              </td>
              <td>
                {r.threshold && <b className="mono">{criterionLabel(r.criterion)}</b>}
                <div className={r.threshold ? "muted small" : "small"}>{r.detail || r.summary}</div>
              </td>
              <td>{r.assetType}</td>
              <td className="mono small">{r.section}</td>
              <td>
                {r.status === "Book" ? (
                  <StatusPill tone="info">Book</StatusPill>
                ) : (
                  <StatusPill tone="warn">Working target</StatusPill>
                )}
                {r.partial && (
                  <>
                    {" "}
                    <StatusPill tone="mute">Partial</StatusPill>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The venue requirements register: provenance, then every check by chapter. */
export default function FifaLibrary() {
  const records = fifaRequirementRecords();
  const bySite = SITE_ORDER.map((site) => [site, records.filter((r) => r.assetType === site).length]);
  const book = records.filter((r) => r.status === "Book").length;
  return (
    <section className="comp-block fifa-library" aria-labelledby="fifa-library-title">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">FIFA venue requirements register</span>
          <h2 id="fifa-library-title">
            {records.length} checks in {CHAPTERS.length} chapters
          </h2>
          <p>
            Register dated {FIFA_CATALOGUE.registerDate} · {bySite.map(([site, n]) => `${n} ${site === "IBC" ? site : site.toLowerCase()}`).join(" · ")}
          </p>
        </div>
      </div>
      <p>{FIFA_CATALOGUE.provenance}</p>
      <p className="small">
        <StatusPill tone="warn">Working target</StatusPill> {FIFA_CATALOGUE.status.WT}; assessed as provisional.{" "}
        <StatusPill tone="info">Book</StatusPill> {FIFA_CATALOGUE.status.Book}. {book} checks have a book criterion;
        numerical ones are checked automatically when evidence is recorded. {FIFA_CATALOGUE.capacityTiers.note}
      </p>
      {CHAPTERS.map((c, i) => {
        const mine = records.filter((r) => r.chapter === c.id);
        return (
          <details key={c.id} className="comp-detail" open={i === 0}>
            <summary>
              <div>
                <span>
                  {c.id} · {c.name}
                </span>
                <small>
                  {c.summary} Book page {c.bookPage}.
                </small>
              </div>
              <div className="fifa-chapter-count">
                <b>{c.checks}</b>
                <small>{c.stadiumChecks} for stadiums</small>
              </div>
            </summary>
            <div className="comp-detail-body">
              <Requirements records={mine} />
            </div>
          </details>
        );
      })}
    </section>
  );
}
