// Server Component: renders the requirement register at build time, grouped by the chapters
// ("families") of the FIFA stadium book.
import { FIFA_CATALOGUE, criterionLabel, fifaRequirementRecords } from "@/lib/domain/fifa-catalogue.mjs";

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const order = (r) => r.sectionId.split(".").map(Number);
const bySection = (a, b) => order(a)[0] - order(b)[0] || order(a)[1] - order(b)[1] || a.id.localeCompare(b.id);

function SourceInventory() {
  const { sources } = FIFA_CATALOGUE;
  return (
    <details className="comp-detail">
      <summary>Source inventory · {sources.length} entries</summary>
      <div className="comp-detail-body tablewrap">
        <table>
          <thead>
            <tr>
              <th>Publication</th>
              <th>Edition</th>
              <th>Used for</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.url ? <ExternalLink href={s.url}>{s.title}</ExternalLink> : s.title}</td>
                <td>{s.edition}</td>
                <td>{s.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** The value of a requirement, with its basis and (where the 2034 clause is not confirmed) the disclaimer under it. */
function Criterion({ r }) {
  const numeric = r.criterion.operator !== "manual";
  return (
    <>
      <b className={numeric ? "mono" : "lib-value"}>{criterionLabel(r.criterion)}</b>
      {!r.generic && r.summary && (
        <>
          <br />
          <span className="muted">{r.summary}</span>
        </>
      )}
      {r.generic && (
        <div className="muted fine lib-disclaimer">
          {r.referenceBasis === "book" ? "FIFA stadium book" : "Working target"} · Threshold to be confirmed (2034 clause)
        </div>
      )}
    </>
  );
}

function RequirementTable({ records }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">Criterion</th>
            <th scope="col">Applies to</th>
            <th scope="col">Source and evidence</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="mono">{r.id}</span>
                <br />
                {r.title}
                <br />
                <small>{r.workstream}</small>
              </td>
              <td>
                <Criterion r={r} />
              </td>
              <td>{r.assetType}</td>
              <td>
                {r.sourceUrl ? <ExternalLink href={r.sourceUrl}>{r.source.title}</ExternalLink> : r.source.title}
                <br />
                <span className="muted">
                  Book section {r.section} · p. {r.printedPage}
                </span>
                <p>Evidence requested · {r.suggestedEvidence}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The requirement register: every check, grouped by chapter of the FIFA stadium book. */
export default function FifaLibrary() {
  const records = fifaRequirementRecords();
  const { families } = FIFA_CATALOGUE;
  const stadium = records.filter((r) => r.appliesTo.includes("stadium")).length;
  return (
    <section className="comp-block fifa-library" aria-labelledby="fifa-library-title">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">Requirement register</span>
          <h2 id="fifa-library-title">Requirements by chapter</h2>
          <p>
            {records.length} checks in {families.filter((f) => records.some((r) => r.familyId === f.id)).length} chapters of the FIFA stadium
            book · {stadium} apply to stadiums · register dated {FIFA_CATALOGUE.reviewedOn}
          </p>
        </div>
      </div>
      <p>{FIFA_CATALOGUE.scopeNote}</p>
      <p className="muted small">
        Every requirement shows a value. Values taken from the FIFA stadium book say so; the others are working targets, and all stay subject to the 2034 contract clause.
      </p>
      <p>Each stadium&apos;s page shows which of these checks apply to it and the evidence assessed against them.</p>
      <SourceInventory />
      {families.map((family) => {
        const own = records.filter((r) => r.familyId === family.id).sort(bySection);
        if (!own.length)
          return (
            <p key={family.id} className="muted small">
              {family.id} · {family.name}: no requirement in the 2034 stadium register.
            </p>
          );
        const forStadium = own.filter((r) => r.appliesTo.includes("stadium")).length;
        return (
          <details key={family.id} className="comp-detail">
            <summary>
              <div>
                <span>
                  {family.id} · {family.name}
                </span>
                <small>
                  {family.description} {forStadium} for stadiums
                  {own.length > forStadium ? `, ${own.length - forStadium} for other sites` : ""} · book p. {family.chapterPage}
                </small>
              </div>
              <b>{own.length}</b>
            </summary>
            <div className="comp-detail-body">
              <RequirementTable records={own} />
            </div>
          </details>
        );
      })}
    </section>
  );
}
