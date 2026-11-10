# Facility register

`register.json` lists the programme's facilities as declared in Saudi Arabia's
FIFA World Cup 2034 bid: 15 stadiums across 5 host cities, with totals for
training sites, fan festival sites and airports. The Compliance page renders it
through `frontend/src/lib/domain/facilities.mjs`.

## Source

Every fact currently comes from one **secondary** source: Al Rajhi Capital,
*Saudi Arabia FIFA World Cup 2034 Bid: Tremendous Growth* (23 December 2024),
which reproduces tables from the bid document. Each record keeps its
`sourceId` and page. Only facts (names, numbers, statuses) are stored, not the
report's text.

Replace it with the bid book or the FIFA evaluation report when obtained (the
`fifa-wc2034-bid-book` source entry is reserved for that), then re-check every
value.

Known source issues:

- Prince Mohammed bin Salman Stadium's capacity is printed as `46.979`; it is
  read as 46,979 and flagged with `capacityNote`.
- The report's headline gives a total design capacity of "over 728,000 seats";
  the gross capacities in its stadium table add up to 775,849. The register
  stores the gross capacities per stadium.
- Training sites (134) and fan festival sites (10) are totals only; there is no
  per-site list yet.

## How it links to the FIFA catalogue

Each stadium's `highestMatch` selects its capacity requirement from
`data/fifa/catalogue.json`: opening and final → `F34-ST-CAP-03` (80,000),
semi-final → `F34-ST-CAP-02` (60,000), every other match → `F34-ST-CAP-01`
(40,000). The register compares the declared gross capacity with that minimum.

That comparison is a **declared** check, not an assessment: the result is
"declared meets" or "declared short", with evidence pending. An assessment
needs reviewed evidence (seating plan and confirmed match allocation) and
belongs in the assessment store keyed by facility, requirement and version.

## Link to the simulation

Five stadiums carry a `simulationId` (RUH, JED, KHO, AHB, NEO): the venues the
existing demo simulation uses. The simulation's own capacities are approximate
and are not yet driven by this register.

## Assessments

Assessments are one record per facility × requirement × version
(`frontend/src/lib/domain/assessment.mjs`, stored by
`frontend/src/lib/store/assessments.js` in the browser under
`wca-assessments-v1`, separate from the demo simulation; "Reset demo" restores
the seed).

- **Applicability** is decided by rule for each stadium: requirements for other
  asset types do not apply; of the capacity rules only the one for the
  stadium's highest match applies; lighting criteria are **provisional** (the
  2020 Lighting Guide is a provisional 2034 baseline); everything else that
  names all match allocations applies.
- **Status** runs unassessed → declared (from the register) → evidence
  submitted → compliant or non-compliant. Numeric criteria are checked when
  evidence is recorded (strict and inclusive operators are respected);
  qualitative criteria are marked for a reviewer. Only a reviewer decision
  makes a requirement compliant.
- The seed holds the 15 declared capacities; everything else starts
  unassessed. Each facility's page (`/facilities/<id>`) shows coverage and lets
  a reviewer record evidence and decide.

A shared, multi-user store (and real document intake) will replace browser
storage before this is used beyond a demo.
