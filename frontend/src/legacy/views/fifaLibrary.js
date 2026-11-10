import { esc } from "@/lib/domain/data";
import { FIFA_CATALOGUE, fifaRequirementRecords, criterionLabel } from "@/lib/domain/fifa-catalogue.mjs";

function sourceInventory() {
  return `<details class="comp-detail"><summary>Source inventory · ${FIFA_CATALOGUE.sources.length} entries</summary>
    <div class="comp-detail-body tablewrap"><table><thead><tr><th>Publication</th><th>Authority and coverage</th><th>Review status</th></tr></thead><tbody>
    ${FIFA_CATALOGUE.sources.map((s) => `<tr>
      <td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title)}<br>${esc(s.edition)}</td>
      <td>${esc(s.authority)}<br><span class="muted">${esc(s.coverage.join(" · "))}</span></td>
      <td>${esc(s.availability.replaceAll("-", " "))} · ${esc(s.reviewStatus.replaceAll("-", " "))}<p>${esc(s.limitations)}</p></td>
    </tr>`).join("")}</tbody></table></div></details>`;
}

function requirementTable(records) {
  return `<div class="tablewrap"><table><thead><tr><th scope="col">Requirement</th><th scope="col">Scope</th><th scope="col">Criterion and review</th><th scope="col">Source and evidence</th></tr></thead>
    <tbody>${records.map((r) => `<tr>
      <td><span class="mono">${esc(r.id)}</span><br>${esc(r.title)}<br><small>${esc(r.authority.replaceAll("-", " "))}</small></td>
      <td>${esc(r.assetType)}<br><span class="muted">${esc(r.condition)}</span>
        ${r.planes ? `<p>Each plane · ${esc(r.planes.join(" · "))}</p>` : ""}
        ${r.measurementLocation ? `<p>${esc(r.measurementLocation)}</p>` : ""}</td>
      <td>${esc(criterionLabel(r.criterion))}<br><span class="pill p-mute">Applicability pending</span>
        ${r.criterion.aggregation ? `<p>${esc(r.criterion.aggregation)}</p>` : ""}
        ${r.reviewIssues.map((issue) => `<p class="pill p-warn">${esc(issue.title)} · review required</p>`).join("")}</td>
      <td><a href="${esc(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(r.source.shortTitle)} · p. ${r.printedPage}</a><br><span class="muted">${esc(r.section)} · ${esc(r.topic)}</span>
        ${r.basisRequirementId ? `<p>2034 basis · ${esc(r.basisRequirementId)}</p>` : ""}
        <p>Proposed evidence · ${esc(r.evidence.length ? r.evidence.map((e) => e.name).join(" · ") : r.suggestedEvidence)}</p>
      </td>
    </tr>`).join("")}</tbody></table></div>`;
}

function lightingReview() {
  return `<details class="comp-detail"><summary>Evidence and interpretation review</summary><div class="comp-detail-body">
    <h3>Measurement definitions</h3>
    ${FIFA_CATALOGUE.lightingScope.measurementDefinitions.map((definition) => {
      const source = FIFA_CATALOGUE.sources.find((s) => s.id === definition.sourceId);
      return `<p><b>${esc(definition.name)}</b> · ${esc(definition.description)} <a href="${esc(source.url)}#page=${definition.pdfPage}" target="_blank" rel="noopener noreferrer">p. ${definition.printedPage}</a></p>`;
    }).join("")}
    <h3>Proposed evidence packs</h3>
    ${FIFA_CATALOGUE.evidenceSpecifications.map((e) => `<h4>${esc(e.name)}</h4><p>${esc(e.reviewPurpose)}</p><ul>${e.fields.map((field) => `<li>${esc(field)}</li>`).join("")}</ul>`).join("")}
    <h3>Open source interpretations</h3>
    ${FIFA_CATALOGUE.reviewIssues.map((issue) => {
      const source = FIFA_CATALOGUE.sources.find((s) => s.id === issue.sourceId);
      return `<h4>${esc(issue.title)}</h4><p>${esc(issue.detail)} ${issue.pages.map((p) => `<a href="${esc(source.url)}#page=${p + 1}" target="_blank" rel="noopener noreferrer">p. ${p}</a>`).join(" · ")}</p>`;
    }).join("")}
    <h3>Inputs to confirm with partners</h3><ul>${FIFA_CATALOGUE.lightingScope.businessInputs.map((input) => `<li>${esc(input)}</li>`).join("")}</ul>
    <h3>Existing demo migration</h3>${FIFA_CATALOGUE.lightingScope.legacyDifferences.map((difference) => `<p><b>${esc(difference.legacyCode)}</b> · ${esc(difference.detail)} Reference ${esc(difference.requirementIds.join(" · "))}.</p>`).join("")}
  </div></details>`;
}

export function fifaLibrary() {
  const records = fifaRequirementRecords();
  return `<section class="comp-block fifa-library" aria-labelledby="fifa-library-title">
    <div class="comp-block-head"><div><span class="eyebrow">FIFA source library</span>
      <h2 id="fifa-library-title">Sourced requirements</h2>
      <p>${records.length} criteria · Source subset checked ${esc(FIFA_CATALOGUE.reviewedOn)}</p>
    </div></div>
    <p>${esc(FIFA_CATALOGUE.scopeNote)}</p>
    <p>Facility applicability awaits review. Facility assessments will be linked after applicability is confirmed.</p>
    ${sourceInventory()}
    <h3>${esc(FIFA_CATALOGUE.lightingScope.title)}</h3><p>${esc(FIFA_CATALOGUE.lightingScope.scopeNote)}</p>
    ${FIFA_CATALOGUE.lightingProfiles.map((profile) => {
      const selected = records.filter((r) => r.profileId === profile.id);
      return `<details class="comp-detail"><summary>${esc(profile.name)} · ${selected.length} criteria</summary><div class="comp-detail-body"><p>${esc(profile.scopeNote)}</p>${requirementTable(selected)}</div></details>`;
    }).join("")}
    ${lightingReview()}
    <details class="comp-detail"><summary>Initial infrastructure subset</summary><div class="comp-detail-body">${requirementTable(records.filter((r) => !r.profileId))}</div></details>
  </section>`;
}
