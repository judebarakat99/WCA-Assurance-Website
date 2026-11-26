// Server Component: the FIFA venue requirements register, by chapter of the FIFA stadium book, rendered at
// build time. The chapters open and close on the page (CollapsibleList); the register downloads as CSV.
import StatusPill from "@/components/atoms/StatusPill";
import CollapsibleList from "@/components/molecules/CollapsibleList";
import CsvDownload from "@/components/molecules/CsvDownload";
import { FIFA_CATALOGUE, criterionLabel, fifaRequirementRecords } from "@/lib/domain/fifa-catalogue.mjs";

const SITE_ORDER = ["Stadium", "Training site", "Fan festival", "IBC"];
const order = (r) => r.sectionId.split(".").map(Number);
const bySection = (a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1] || a.id.localeCompare(b.id);

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
          {records.map((r) => {
            const numeric = r.criterion.operator !== "manual";
            return (
              <tr key={r.id}>
                <td className="mono small">{r.id}</td>
                <td>
                  <b>{r.title}</b>
                  <div className="muted fine">{r.workstream}</div>
                </td>
                <td>
                  {numeric ? (
                    <b className="mono">{criterionLabel(r.criterion)}</b>
                  ) : (
                    <div className="small">{criterionLabel(r.criterion)}</div>
                  )}
                  {!r.generic && r.summary && <div className="muted small">{r.summary}</div>}
                </td>
                <td>{r.assetType}</td>
                <td className="mono small">
                  {r.sectionId} · p. {r.pdfPage}
                </td>
                <td>
                  {r.applicability === "applicable" ? (
                    <StatusPill tone="info">Book</StatusPill>
                  ) : (
                    <StatusPill tone="warn">Working target</StatusPill>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Sources() {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Publication</th>
            <th>Edition</th>
            <th>Used for</th>
          </tr>
        </thead>
        <tbody>
          {FIFA_CATALOGUE.sources.map((s) => (
            <tr key={s.id}>
              <td>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </td>
              <td>{s.edition}</td>
              <td>{s.kind}</td>
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
  const chapters = FIFA_CATALOGUE.families
    .map((family) => ({ family, own: records.filter((r) => r.familyId === family.id).sort(bySection) }))
    .filter((c) => c.own.length);
  const bySite = SITE_ORDER.map((site) => [site, records.filter((r) => r.assetType === site).length]);
  const book = records.filter((r) => r.applicability === "applicable").length;
  const items = chapters.map(({ family, own }, i) => {
    const forStadium = own.filter((r) => r.appliesTo.includes("stadium")).length;
    return {
      id: family.id,
      open: i === 0,
      summary: (
        <>
          <div>
            <span>
              {family.id} · {family.name}
            </span>
            <small>
              {family.description} Book page {family.chapterPage}.
            </small>
          </div>
          <div className="fifa-chapter-count">
            <b>{own.length}</b>
            <small>{forStadium} for stadiums</small>
          </div>
        </>
      ),
      body: <Requirements records={own} />,
    };
  });
  items.push({
    id: "sources",
    summary: (
      <div>
        <span>Sources</span>
        <small>{FIFA_CATALOGUE.sources.length} publications the register is taken from.</small>
      </div>
    ),
    body: <Sources />,
  });
  return (
    <section className="comp-block fifa-library" aria-labelledby="fifa-library-title">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">FIFA venue requirements register</span>
          <h2 id="fifa-library-title">
            {records.length} checks in {chapters.length} chapters
          </h2>
          <p>
            Register dated {FIFA_CATALOGUE.reviewedOn} ·{" "}
            {bySite.map(([site, n]) => `${n} ${site === "IBC" ? site : site.toLowerCase()}`).join(" · ")}
          </p>
        </div>
      </div>
      <p>{FIFA_CATALOGUE.scopeNote}</p>
      <p className="small">
        <StatusPill tone="warn">Working target</StatusPill> threshold still to be confirmed against the 2034 clause;
        assessed as provisional. <StatusPill tone="info">Book</StatusPill> criterion taken from the FIFA stadium book.{" "}
        {book} checks have a book criterion; numerical ones are checked automatically when evidence is recorded. Each
        stadium&apos;s page shows which checks apply to it and the evidence assessed against them.
      </p>
      <CollapsibleList
        heading={
          <h3 id="fifa-chapters" className="m0">
            Requirements by chapter of the FIFA stadium book
          </h3>
        }
        actions={<CsvDownload dataset="requirements" label="Download requirements (CSV)" />}
        items={items}
      />
    </section>
  );
}
