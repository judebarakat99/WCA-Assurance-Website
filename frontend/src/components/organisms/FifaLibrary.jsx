// Server Component: renders the bundled FIFA catalogue at build time.
import StatusPill from "@/components/atoms/StatusPill";
import { FIFA_CATALOGUE, fifaRequirementRecords, criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";

const words = (s) => s.replaceAll("-", " ");
const sourceById = (id) => FIFA_CATALOGUE.sources.find((s) => s.id === id);

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

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
              <th>Authority and coverage</th>
              <th>Review status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  {s.url ? <ExternalLink href={s.url}>{s.title}</ExternalLink> : s.title}
                  <br />
                  {s.edition}
                </td>
                <td>
                  {s.authority}
                  <br />
                  <span className="muted">{s.coverage.join(" · ")}</span>
                </td>
                <td>
                  {words(s.availability)} · {words(s.reviewStatus)}
                  <p>{s.limitations}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function RequirementTable({ records }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Requirement</th>
            <th scope="col">Scope</th>
            <th scope="col">Criterion and review</th>
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
                <small>{words(r.authority)}</small>
              </td>
              <td>
                {r.assetType}
                <br />
                <span className="muted">{r.condition}</span>
                {r.planes && <p>Each plane · {r.planes.join(" · ")}</p>}
                {r.measurementLocation && <p>{r.measurementLocation}</p>}
              </td>
              <td>
                {criterionLabel(r.criterion)}
                <br />
                <StatusPill tone="mute">Applicability pending</StatusPill>
                {r.criterion.aggregation && <p>{r.criterion.aggregation}</p>}
                {r.reviewIssues.map((issue) => (
                  <p key={issue.id} className="pill p-warn">
                    {issue.title} · review required
                  </p>
                ))}
              </td>
              <td>
                <ExternalLink href={r.sourceUrl}>
                  {r.source.shortTitle} · p. {r.printedPage}
                </ExternalLink>
                <br />
                <span className="muted">
                  {r.section} · {r.topic}
                </span>
                {r.basisRequirementId && <p>2034 basis · {r.basisRequirementId}</p>}
                <p>
                  Proposed evidence ·{" "}
                  {r.evidence.length ? r.evidence.map((e) => e.name).join(" · ") : r.suggestedEvidence}
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LightingReview() {
  const { lightingScope, evidenceSpecifications, reviewIssues } = FIFA_CATALOGUE;
  return (
    <details className="comp-detail">
      <summary>Evidence and interpretation review</summary>
      <div className="comp-detail-body">
        <h3>Measurement definitions</h3>
        {lightingScope.measurementDefinitions.map((d) => (
          <p key={d.name}>
            <b>{d.name}</b> · {d.description}{" "}
            <ExternalLink href={`${sourceById(d.sourceId).url}#page=${d.pdfPage}`}>p. {d.printedPage}</ExternalLink>
          </p>
        ))}
        <h3>Proposed evidence packs</h3>
        {evidenceSpecifications.map((e) => (
          <div key={e.id}>
            <h4>{e.name}</h4>
            <p>{e.reviewPurpose}</p>
            <ul>
              {e.fields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        ))}
        <h3>Open source interpretations</h3>
        {reviewIssues.map((issue) => {
          const source = sourceById(issue.sourceId);
          return (
            <div key={issue.id}>
              <h4>{issue.title}</h4>
              <p>
                {issue.detail}{" "}
                {issue.pages.map((p, k) => (
                  <span key={p}>
                    {k > 0 && " · "}
                    <ExternalLink href={`${source.url}#page=${p + 1}`}>p. {p}</ExternalLink>
                  </span>
                ))}
              </p>
            </div>
          );
        })}
        <h3>Inputs to confirm with partners</h3>
        <ul>
          {lightingScope.businessInputs.map((input) => (
            <li key={input}>{input}</li>
          ))}
        </ul>
        <h3>Existing demo migration</h3>
        {lightingScope.legacyDifferences.map((d) => (
          <p key={d.legacyCode}>
            <b>{d.legacyCode}</b> · {d.detail} Reference {d.requirementIds.join(" · ")}.
          </p>
        ))}
      </div>
    </details>
  );
}

/** The sourced FIFA requirements catalogue, with sources, lighting profiles and open issues. */
export default function FifaLibrary() {
  const records = fifaRequirementRecords();
  const { lightingScope, lightingProfiles } = FIFA_CATALOGUE;
  return (
    <section className="comp-block fifa-library" aria-labelledby="fifa-library-title">
      <div className="comp-block-head">
        <div>
          <span className="eyebrow">FIFA source library</span>
          <h2 id="fifa-library-title">Sourced requirements</h2>
          <p>
            {records.length} criteria · Source subset checked {FIFA_CATALOGUE.reviewedOn}
          </p>
        </div>
      </div>
      <p>{FIFA_CATALOGUE.scopeNote}</p>
      <p>Facility applicability awaits review. Facility assessments will be linked after applicability is confirmed.</p>
      <SourceInventory />
      <h3>{lightingScope.title}</h3>
      <p>{lightingScope.scopeNote}</p>
      {lightingProfiles.map((profile) => {
        const selected = records.filter((r) => r.profileId === profile.id);
        return (
          <details key={profile.id} className="comp-detail">
            <summary>
              {profile.name} · {selected.length} criteria
            </summary>
            <div className="comp-detail-body">
              <p>{profile.scopeNote}</p>
              <RequirementTable records={selected} />
            </div>
          </details>
        );
      })}
      <LightingReview />
      <details className="comp-detail">
        <summary>Initial infrastructure subset</summary>
        <div className="comp-detail-body">
          <RequirementTable records={records.filter((r) => !r.profileId)} />
        </div>
      </details>
    </section>
  );
}
