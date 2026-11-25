# Compliance register

The CSV files here are the source of truth for the requirements and for each stadium's compliance with them.

| File | One row per | Columns |
|---|---|---|
| `families.csv` | chapter of the FIFA stadium book (the "family") | id, name, short, chapter_page, description, default_owner, in_scope |
| `sections.csv` | section in the book's table of contents | id, family_id, title, page |
| `sources.csv` | source document | id, title, publisher, url, edition, kind |
| `requirements.csv` | check from the FIFA 2034 infrastructure checklist | id, family_id, section, workstream, check_item, criterion_note, source_class, source_id, source_url, clause_2034, evidence_requested, applies_to, applicability, operator, value, minimum, maximum, unit, description, pdf_page |
| `compliance.csv` | stadium and requirement | stadium_id, id, status, value, unit, check, evidence_file, evidence_on, reviewed_by, owner, comments, updated_on |

`status` is one of: Not assessed, Evidence submitted, Compliant, Partially compliant, Non-compliant, Not applicable.
"Fulfilled" means Compliant. "Not fulfilled" means Non-compliant or Partially compliant.

`applies_to` is stadium, training-site, fan-festival or ibc. Only `stadium` requirements are assessed per stadium.
`operator` is manual (no machine check) or min, max, eq, gt, gte, lt, lte or range; the checks compare `value` (or `minimum` and `maximum`) with the evidence `value`.

## Changing the data

1. Edit a CSV (Excel is fine; keep UTF-8), or replace `compliance.csv` with a register exported from the app.
2. From `frontend/`, run `npm run register:build`. It validates every row and rewrites `src/lib/register/register.generated.json`.
   It also runs before `npm run dev` and `npm run build`.

## How document intake updates the register

Evidence and reviews recorded in the app (including what the intake agent files) are kept in the browser's storage.
The **Download register (CSV)** button on a stadium page exports the whole register in the format of `compliance.csv`,
with those changes applied. Replace `compliance.csv` with that file and run `npm run register:build` to make them the new seed.
A backend that writes `compliance.csv` directly needs no other change: the pages read the same file.
