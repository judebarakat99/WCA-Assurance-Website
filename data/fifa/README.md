# FIFA reference data

`catalogue.json` is the shared source of sourced requirement definitions. Both applications can consume this JSON. The Compliance page renders it directly through `frontend/lib/fifa-catalogue.mjs`.

## First increment

The initial subset covers stadium capacity, pitch dimensions and training-site criteria from FIFA's public 2034 hosting overview linked in its 31 October 2023 announcement. Section 1.3 explains the document's limits and later specifications. The publication date records the announcement date, not an asserted PDF revision date. Requirement IDs and categories are local catalogue identifiers.

Each record preserves its source, printed page and PDF page, scope, conditions, and structured criterion. Text is paraphrased. `source-checked` means checked against the cited publication. Tournament applicability still needs business review. Suggested evidence is a PoC assessment design choice.

## Data ownership

- Source metadata and requirement definitions belong here. Views consume records and calculate counts.
- Facility assessments, submitted evidence and review decisions belong in a separate operational store, linked by requirement ID and version plus facility ID.
- A published requirement does not establish a facility's assessment result. Missing assessments must display as unassessed.
- Geography, asset type and requirement category are separate dimensions. Match allocation must be confirmed before assigning a capacity criterion.
- Source editions are immutable. Add a new source/version when requirements change, then explicitly reassess affected records.

## Remaining migration

The existing operational simulation uses `frontend/lib/state.js` and browser localStorage. Its illustrative definitions remain in `frontend/lib/data.js`. The old Compliance dashboard still uses `frontend/lib/complianceData.js`; its generated statuses are labelled as a legacy simulation in the UI. Neither dataset has been mapped to these sourced requirements. Existing evidence cannot be transferred automatically because criteria and applicability differ.

Next, agree facility types and match allocations, introduce explicit requirement-to-facility assessments, and migrate Compliance to that store. Then move the other dashboards and assistant to the same assessment selectors. A server database will be needed for shared multi-user persistence; this catalogue is currently version-controlled and bundled at build time.

## Lighting increment

Schema version 2 adds a source inventory, stadium and training lighting profiles, evidence specifications, and open interpretation issues. The official FIFA Lighting Guide 2020.01 PDF was retrieved from FIFA's Digital Hub through its Stadium Guidelines annexe. Its SHA-256 digest is recorded in the source inventory. The Standard A and Grade 1 tables were visually checked against printed pages 11 and 41.

The catalogue links each technical record to the applicable class specified in the public 2034 overview. This is a provisional baseline pending the issued tournament package and amendments. Sources marked `inventory-only` have no extracted criteria. The complete hosting package is recorded as `not-obtained`; the partner request is an input checklist and has not been sent.

Numeric operators preserve strict versus inclusive comparisons. Vertical metrics apply separately to every listed plane. Maintenance factors are design defaults with a variation reference. U1 and U2 definitions are stored alongside their source references. Manual power-profile checks require specialist assessment of the referenced sections. The table subset does not cover the full engineering design, all control obligations, entertainment lighting or environmental design.

Open interpretation records preserve source inconsistencies and uncertain boundary/counting rules. They must be resolved before automatic pass/fail assessment. Recommendations carry their own authority type. Evidence specifications describe our proposed submission format; they are not assertions that FIFA mandates that exact packaging.

Legacy `LGT-01` and `LGT-02` metrics have incompatible plane/threshold definitions. Existing simulated evidence and verified statuses cannot safely be reused. The new catalogue displays the differences and keeps all facility applicability pending. The next implementation step is an assessment model keyed by facility, requirement ID and version, with separate evidence and reviewer records.

## Extending the catalogue

Check the primary publication and table qualifications, preserve source links and page references, distinguish mandatory text from recommendations, and record any unresolved applicability. Add regression coverage for conditional requirements. Avoid inferring criticality, official domains, or compliance status from a source title.
