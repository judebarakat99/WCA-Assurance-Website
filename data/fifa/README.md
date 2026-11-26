# FIFA requirements: source transcription

The requirements the application assesses against live in `data/register/`
(`requirements.csv` and the other register CSVs): the **FIFA World Cup 2034
venue requirements register** dated 20 November 2026, **181 checks in 11
chapters** of the FIFA stadium book, **123 of them for stadiums** (38 training
site, 14 fan festival, 6 IBC). See `data/register/README.md`.

`requirements-register-2026-11-20.md` is where those checks come from: a
transcription of screenshots of a 52-page register. It is **not an
independently verified statement of FIFA's contractual requirements**. Source
titles, URLs, page numbers and the evidence column were cropped in the
screenshots and have not been reconstructed.

Capacity (`STA-0004`) depends on each stadium's highest match: 40,000 seats up
to the quarter-final and the third-place play-off, 60,000 for a semi-final and
80,000 for the opening match and final
(`frontend/src/lib/domain/facilities.mjs`).
