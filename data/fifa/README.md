# FIFA reference data

`catalogue.json` is the requirements catalogue the application assesses against:
the **FIFA World Cup 2034 venue requirements register** dated 20 November 2026,
**181 checks in 11 chapters** of the FIFA stadium book, **123 of them for
stadiums** (38 training site, 14 fan festival, 6 IBC). The frontend reads it
through `frontend/src/lib/domain/fifa-catalogue.mjs`; the Requirements page
lists it chapter by chapter.

## Source and limits

`requirements-register-2026-11-20.md` is the source: a transcription of
screenshots of a 52-page register. It is **not an independently verified
statement of FIFA's contractual requirements**. Source titles, URLs, page
numbers and the evidence column were cropped in the screenshots and have not
been reconstructed. One fan-festival check's ID and opening words are not
legible; it is stored as `FAN-UNREADABLE` with `partial: true`, and no ID or
wording has been invented.

`catalogue.json` was converted from that file mechanically; counts reconcile
with the source (13 + 16 + 12 + 23 + 34 + 15 + 8 + 20 + 9 + 8 + 23 = 181).

## Record shape

Each requirement keeps its `id`, `chapter` (`"01"`–`"11"`), `category` (the
chapter name), `title`, `summary` (the criterion as worded), `assetType`
(Stadium, Training site, Fan festival or IBC), book `section`, and `status`:

- `WT`: working target, threshold to be confirmed against the 2034 contract
  clause. Assessed as **provisional**; evidence goes to a reviewer.
- `Book`: a criterion from the FIFA stadium book or guidance (still subject to
  the 2034 clause). Numerical ones have a structured `criterion`
  (`min`, `max` or `range`, with `value` and `unit`) and are checked
  automatically when evidence is recorded; the rest are `manual`.

`STA-0004` (capacity) has thresholds by match category in `criterion.tiers`:
40,000 seats up to the quarter-final and the third-place play-off, 60,000 for a
semi-final, 80,000 for the opening match and final. Each stadium's
`highestMatch` in the facility register selects its threshold.

## Data ownership

- Requirement definitions belong here. Views consume records and calculate counts.
- Facility assessments, evidence and review decisions belong in the
  assessment store, linked by requirement ID and version plus facility ID.
- A requirement does not establish a facility's assessment result. Missing
  assessments display as unassessed.
- When a requirement changes, add a new version and reassess affected records.

## Change scenarios (hypothetical)

`change-scenarios.json` holds requirement changes used to demonstrate change
impact on the assurance map. **None has been announced by FIFA.** Each names a
register check and a replacement criterion. Applying one (in the app)
moves that requirement to its next version and re-checks every stadium's
evidence against the new criterion; compliant items that no longer pass are
reopened for review. Applied changes are kept in the browser
(`wca-requirement-changes-v1`) and cleared by "Reset demo" or by reloading the
sample assessments.
