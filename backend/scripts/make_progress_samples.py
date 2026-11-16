"""Generate the fictional contractor documents for the progress-verification
demo: one executive progress report per stadium and one detailed plan per
scope element, as text PDFs, plus the expected results.

Run from backend/:  poetry run python -m scripts.make_progress_samples
Output: data/progress/ at the repository root.
"""

import json
from datetime import date, timedelta
from pathlib import Path

from app.progress_calc import overall, package_progress

ROOT = Path(__file__).resolve().parents[2] / "data" / "progress"
AS_OF = date(2026, 11, 15)
FOOTER = "SAMPLE DATA - fictional contractor document generated for the WCA assurance demo."

# ---------------------------------------------------------------- tiny PDF writer


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class Pdf:
    """A4 pages of positioned text and rules. ASCII text only."""

    W, H = 595, 842

    def __init__(self):
        self.pages: list[list[str]] = []

    def page(self):
        self.pages.append([])
        return self

    def text(self, x, y, s, size=10, bold=False):
        font = "F2" if bold else "F1"
        self.pages[-1].append(f"BT /{font} {size} Tf {x} {y} Td ({_esc(s)}) Tj ET")

    def rule(self, x1, y1, x2, y2, width=0.5):
        self.pages[-1].append(f"{width} w {x1} {y1} m {x2} {y2} l S")

    def band(self, x, y, w, h, grey=0.92):
        self.pages[-1].append(f"{grey} g {x} {y} {w} {h} re f 0 g")

    def save(self, path: Path):
        objects = [
            "<< /Type /Catalog /Pages 2 0 R >>",
            None,  # pages, filled below
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        ]
        kids = []
        for ops in self.pages:
            stream = "\n".join(ops).encode("latin-1")
            objects.append(f"<< /Length {len(stream)} >>\nstream\n" + stream.decode("latin-1") + "\nendstream")
            content = len(objects)
            objects.append(
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.W} {self.H}] "
                f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {content} 0 R >>"
            )
            kids.append(f"{len(objects)} 0 R")
        objects[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"
        out = bytearray(b"%PDF-1.4\n")
        offsets = []
        for i, body in enumerate(objects, start=1):
            offsets.append(len(out))
            out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
        xref = len(out)
        out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
        out += "".join(f"{o:010d} 00000 n \n" for o in offsets).encode()
        out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes(out))


def wrap(text: str, width: int = 95) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        if len(line) + len(word) + 1 > width:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}".strip()
    return lines + ([line] if line else [])


def paragraph(pdf: Pdf, y: float, text: str, size=10, width=95) -> float:
    for line in wrap(text, width):
        pdf.text(50, y, line, size)
        y -= size + 4
    return y - 6


def footer(pdf: Pdf, n: int, of: int):
    pdf.rule(50, 50, 545, 50)
    pdf.text(50, 36, FOOTER, 7)
    pdf.text(510, 36, f"Page {n} of {of}", 7)


# ---------------------------------------------------------------- scenario

ACTIVITIES = {
    "pitch-turf": [
        ("Site survey and level set-out", 6),
        ("Sub-base excavation and grading", 10),
        ("Primary and secondary drainage", 12),
        ("Irrigation network", 10),
        ("Root-zone cooling pipework", 12),
        ("Root-zone construction", 14),
        ("Hybrid turf stitching", 12),
        ("Grow-in and establishment", 10),
        ("Pitch surrounds and run-off", 6),
        ("Pitch quality test", 8),
    ],
    "floodlighting": [
        ("Lighting design approval", 5),
        ("Roof truss structural survey", 6),
        ("Gantry steelwork", 12),
        ("Medium-voltage supply upgrade", 12),
        ("Cable containment", 9),
        ("Luminaire procurement", 14),
        ("Luminaire installation", 16),
        ("Lighting control system", 10),
        ("Aiming and commissioning", 8),
        ("Illuminance and uniformity test", 8),
    ],
    "seating-stands": [
        ("Removal of existing seating", 6),
        ("Concrete terrace repairs", 12),
        ("Accessible viewing platforms", 8),
        ("Seat procurement", 14),
        ("Seat installation, lower tier", 14),
        ("Seat installation, upper tier", 14),
        ("Vomitories and handrails", 10),
        ("Media tribune seating", 8),
        ("Sightline verification", 6),
        ("Safety certificate inspection", 8),
    ],
    "broadcast-media": [
        ("Camera platforms", 12),
        ("Commentary positions", 12),
        ("Outside-broadcast compound hardstanding", 14),
        ("Cable routes to compound", 12),
        ("Fibre backbone", 16),
        ("Media working area fit-out", 14),
        ("Mixed zone", 8),
        ("Host broadcaster acceptance test", 12),
    ],
}
NAMES = {
    "pitch-turf": "Pitch and turf",
    "floodlighting": "Floodlighting",
    "seating-stands": "Seating and stands",
    "broadcast-media": "Broadcast and media",
}

# planned / actual: the package's true figures at AS_OF; claimed: what the report says.
STADIUMS = {
    "king-fahad-sports-city": {
        "name": "King Fahad Sports City Stadium",
        "code": "KFSC",
        "contractor": "Al Wadi Contracting Co. (fictional)",
        "style": "a",
        "claimed": 70,
        "report": "KFSC-MPR-11",
        "folder": "to-upload",
        "packages": [
            ("pitch-turf", 40, 85, 80, 85, "C"),
            ("floodlighting", 95, 70, 40, 75, "C"),
            ("seating-stands", 120, 68, 55, 65, "B"),
            ("broadcast-media", 45, 60, 45, 60, "B"),
        ],
    },
    "aramco": {
        "name": "Aramco Stadium",
        "code": "ARS",
        "contractor": "Gulf Crest Builders (fictional)",
        "style": "b",
        "claimed": 88,
        "report": "ARS-PR-2026-11",
        "folder": "preloaded",
        "packages": [
            ("pitch-turf", 35, 95, 95, 95, "4"),
            ("floodlighting", 80, 90, 88, 90, "3"),
            ("seating-stands", 140, 88, 86, 86, "5"),
            ("broadcast-media", 40, 82, 80, 82, "2"),
        ],
    },
    "prince-faisal-bin-fahad": {
        "name": "Prince Faisal bin Fahad Sports City Stadium",
        "code": "PFBF",
        "contractor": "Najd Infrastructure JV (fictional)",
        "style": "a",
        "claimed": 58,
        "report": "PFBF-MPR-08",
        "folder": "preloaded",
        "packages": [
            ("pitch-turf", 30, 55, 40, 40, "B"),
            ("floodlighting", 70, 70, 55, 55, "B"),
            ("seating-stands", 150, 75, 62, 62, "C"),
        ],
    },
}
# A later floodlighting plan for King Fahad: more installed, still short of the claim.
REVISION = ("king-fahad-sports-city", "floodlighting", 95, 70, 60, "D")


def schedule(names_weights, planned: float, actual: float, window_days: int = 420):
    """Sequential activities, each lasting in proportion to its weight, placed
    so that planned progress at AS_OF is `planned`; actuals fill in order up
    to `actual`."""
    total = sum(w for _, w in names_weights)
    start = AS_OF - timedelta(days=round(planned / 100 * window_days) - 1)
    rows, cum, remaining = [], 0.0, actual / 100 * total
    for i, (name, weight) in enumerate(names_weights, start=1):
        a = start + timedelta(days=round(cum / total * window_days))
        cum += weight
        b = start + timedelta(days=round(cum / total * window_days) - 1)
        done = max(0.0, min(weight, remaining))
        remaining -= done
        rows.append(
            {
                "seq": i,
                "name": name,
                "weight": weight,
                "start": a,
                "finish": max(a, b),
                "actual": round(100 * done / weight),
            }
        )
    return rows


def fmt_date(d: date, style: str) -> str:
    return d.strftime("%d %b %Y") if style == "a" else d.strftime("%d/%m/%Y")


def plan_pdf(stadium_id, s, element, budget, rows, revision, path: Path):
    style = s["style"]
    pdf = Pdf().page()
    pdf.text(50, 790, s["contractor"], 9)
    title = (
        f"Detailed Delivery Plan and Progress Update - {NAMES[element]}"
        if style == "a"
        else f"{NAMES[element]} Works Programme - Progress Status"
    )
    pdf.text(50, 768, title, 15, bold=True)
    pdf.text(50, 748, f"Project: {s['name']} upgrade for FIFA World Cup 2034", 10)
    meta = [
        ("Work package" if style == "a" else "Package ref", f"{s['code']}-WP-{list(NAMES).index(element) + 1:02d}"),
        ("Revision", revision),
        ("Data date" if style == "a" else "Status date", fmt_date(AS_OF, style)),
        ("Package budget" if style == "a" else "Package value", f"SAR {budget} million"),
    ]
    y = 724
    for k, v in meta:
        pdf.text(50, y, f"{k}:", 10, bold=True)
        pdf.text(160, y, v, 10)
        y -= 15
    y = paragraph(
        pdf,
        y - 8,
        "Activity weights are each activity's share of the package budget. Actual completion is the "
        "percentage of each activity's scope physically complete and accepted on site at the data date, "
        "as recorded by the site team."
        if style == "a"
        else "Share of budget is each task's portion of the package value. Percent done is the site "
        "team's record of physical completion at the status date.",
    )
    head = (
        ["ID", "Activity", "Weight %", "Planned start", "Planned finish", "Actual %"]
        if style == "a"
        else ["Task ref", "Task", "Share of budget %", "Start", "Finish", "% done"]
    )
    xs = [50, 122, 305, 362, 434, 505] if style == "a" else [50, 95, 285, 375, 445, 510]
    y -= 6
    pdf.band(48, y - 5, 499, 18)
    for x, h in zip(xs, head):
        pdf.text(x, y, h, 8.5, bold=True)
    y -= 20
    for r in rows:
        ident = f"{s['code']}-{element[:3].upper()}-{r['seq']:02d}" if style == "a" else f"T{r['seq']:02d}"
        cells = [
            ident,
            r["name"],
            f"{r['weight']}",
            fmt_date(r["start"], style),
            fmt_date(r["finish"], style),
            f"{r['actual']}",
        ]
        for x, c in zip(xs, cells):
            pdf.text(x, y, c, 8.5)
        pdf.rule(50, y - 6, 545, y - 6, 0.3)
        y -= 19
    pdf.text(50, y - 10, f"Total weight: {sum(r['weight'] for r in rows)}%", 9, bold=True)
    footer(pdf, 1, 1)
    pdf.save(path)


def report_pdf(stadium_id, s, packages, path: Path):
    pdf = Pdf().page()
    pdf.text(50, 790, s["contractor"], 9)
    pdf.text(50, 768, "Monthly Progress Report", 18, bold=True)
    pdf.text(50, 746, f"{s['name']} - FIFA World Cup 2034 upgrade", 12)
    y = 722
    for k, v in [
        ("Report no.", s["report"]),
        ("Reporting period", f"16 Oct 2026 to {fmt_date(AS_OF, 'a')}"),
        ("Submitted to", "Programme Management Office"),
    ]:
        pdf.text(50, y, f"{k}:", 10, bold=True)
        pdf.text(160, y, v, 10)
        y -= 15
    pdf.text(50, y - 12, "1. Executive summary", 13, bold=True)
    y = paragraph(
        pdf,
        y - 32,
        f"Works progressed well this period across all packages. Overall progress stands at {s['claimed']}% "
        f"complete as at {fmt_date(AS_OF, 'a')}, and the project remains on track for handover. "
        "Mobilisation of additional crews for the next period has been approved.",
    )
    pdf.band(48, y - 8, 499, 30, 0.88)
    pdf.text(60, y + 2, f"OVERALL PROGRESS: {s['claimed']}%", 14, bold=True)
    y -= 50
    pdf.text(50, y, "2. Progress by package", 13, bold=True)
    y -= 24
    xs = [50, 260, 380]
    pdf.band(48, y - 5, 499, 18)
    for x, h in zip(xs, ["Package", "Budget (SAR m)", "Reported progress"]):
        pdf.text(x, y, h, 9, bold=True)
    y -= 20
    for element, budget, _p, _a, claimed, _rev in packages:
        for x, c in zip(xs, [NAMES[element], f"{budget}", f"{claimed}%"]):
            pdf.text(x, y, c, 9)
        pdf.rule(50, y - 6, 545, y - 6, 0.3)
        y -= 19
    footer(pdf, 1, 2)
    pdf.page()
    y = 790
    pdf.text(50, y, "3. Key achievements this period", 13, bold=True)
    y = paragraph(
        pdf,
        y - 22,
        "Continued installation works across the bowl. Coordination meetings held weekly with the "
        "design consultant and the operator. No lost-time incidents recorded.",
    )
    pdf.text(50, y, "4. Look-ahead", 13, bold=True)
    y = paragraph(pdf, y - 22, "Complete outstanding installation activities and begin testing and commissioning.")
    pdf.text(50, y, "5. Risks and issues", 13, bold=True)
    paragraph(pdf, y - 22, "Long-lead equipment deliveries are being monitored. No risks currently rated high.")
    footer(pdf, 2, 2)
    pdf.save(path)


def main():
    expected = {"as_of": AS_OF.isoformat(), "stadiums": {}}
    for stadium_id, s in STADIUMS.items():
        folder = ROOT / s["folder"] / stadium_id
        packages_out = []
        for element, budget, planned, actual, claimed, revision in s["packages"]:
            rows = schedule(ACTIVITIES[element], planned, actual)
            name = f"{s['code'].lower()}-{element}-plan-rev-{revision}.pdf"
            plan_pdf(stadium_id, s, element, budget, rows, revision, folder / name)
            packages_out.append({"element": element, "budget": budget, "claimed": claimed, "file": name,
                                 **package_progress(rows, AS_OF)})
        report = f"{s['code'].lower()}-progress-report-{AS_OF:%Y-%m}.pdf"
        report_pdf(stadium_id, s, s["packages"], folder / report)
        expected["stadiums"][stadium_id] = {
            "claimed": s["claimed"],
            "report": report,
            "packages": packages_out,
            **{f"overall_{k}": v for k, v in overall(packages_out).items()},
        }
    stadium_id, element, budget, planned, actual, revision = REVISION
    s = STADIUMS[stadium_id]
    rows = schedule(ACTIVITIES[element], planned, actual)
    name = f"{s['code'].lower()}-{element}-plan-rev-{revision}.pdf"
    plan_pdf(stadium_id, s, element, budget, rows, revision, ROOT / "revised" / name)
    expected["revised"] = {"stadium": stadium_id, "element": element, "file": name,
                           **package_progress(rows, AS_OF)}
    (ROOT / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")
    for k, v in expected["stadiums"].items():
        print(k, "claimed", v["claimed"], "actual", v["overall_actual"], "planned", v["overall_planned"])


if __name__ == "__main__":
    main()
