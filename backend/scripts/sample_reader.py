"""A stand-in for the model that reads the generated sample PDFs with regular
expressions, the way the real model is asked to. Used by the backend tests and
to export the readings the frontend's offline demo uses. Not a general reader."""

import json
import re
from datetime import datetime
from types import SimpleNamespace

from app.intake import ELEMENTS, Classification, PlanExtraction, ReportExtraction, Summary

DATE = r"(\d{2} [A-Z][a-z]{2} \d{4}|\d{2}/\d{2}/\d{4})"
NAMES = {v.lower(): k for k, v in ELEMENTS.items()}


def iso(text):
    for fmt in ("%d %b %Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(text)


def pages_of(content):
    return {int(p): t for p, t in re.findall(r"--- PAGE (\d+) ---\n(.*?)(?=\n--- PAGE|\Z)", content, re.S)}


class SampleReader:
    embedding_profile = "fake:2"

    def __init__(self, settings, inflate_summary=False, misread=False):
        self.settings = settings
        self.inflate_summary = inflate_summary
        self.misread = misread
        self.calls = []

    async def embed(self, texts):
        return [[1.0, 0.0] for _ in texts]

    def require_client(self):
        return SimpleNamespace(responses=self)

    async def close(self):
        pass

    async def parse(self, text_format, input, **kwargs):
        content = input[0]["content"]
        self.calls.append(text_format.__name__)
        pages = pages_of(content)
        if text_format is Classification:
            name = re.search(r"FILE NAME: (\S+)", content)[1]
            code = name.split("-")[0]
            stadium = {"kfsc": "king-fahad-sports-city", "ars": "aramco", "pfbf": "prince-faisal-bin-fahad"}[code]
            element = next((e for e in ELEMENTS if f"-{e}-" in name), None)
            first = pages[1].splitlines()[1]
            return SimpleNamespace(output_parsed=Classification(
                kind="detailed-plan" if element else "progress-report", stadium_id=stadium, element=element,
                as_of="2026-11-15", revision=name.split("rev-")[1][:-4] if element else None, title=first,
                evidence_page=1, evidence_quote=first, confidence="high"))
        if text_format is ReportExtraction:
            text = pages[1]
            packages = [
                {"element": NAMES[m[1].lower()], "budget": float(m[2]), "claimed": float(m[3]), "page": 1}
                for m in re.finditer(r"^([A-Za-z ]+?) (\d+) (\d+)%$", text, re.M)
            ]
            overall = re.search(r"OVERALL PROGRESS: (\d+)%", text)
            return SimpleNamespace(output_parsed=ReportExtraction(
                as_of="2026-11-15", overall_claimed=float(overall[1]), overall_page=1,
                overall_quote=overall[0], packages=packages))
        if text_format is PlanExtraction:
            text = pages[1]
            rows = re.finditer(rf"^(\S+) (.+?) (\d+(?:\.\d+)?) {DATE} {DATE} (\d+)$", text, re.M)
            acts = [
                {"ref": m[1], "name": m[2], "weight": float(m[3]), "start": iso(m[4]), "finish": iso(m[5]),
                 "actual": float(m[6]), "page": 1}
                for m in rows
            ]
            if self.misread and self.calls.count("PlanExtraction") == 1:
                acts[0]["actual"] = 77.0  # first read is wrong; the page check must catch it
            return SimpleNamespace(output_parsed=PlanExtraction(
                as_of="2026-11-15", budget=float(re.search(r"SAR (\d+) million", text)[1]), budget_page=1,
                activities=acts))
        if text_format is Summary:
            facts = json.loads(content.split("COMPUTED FINDING:\n")[1].split("\n\n")[0])
            figure = 99 if self.inflate_summary else facts["recalculated"]
            return SimpleNamespace(output_parsed=Summary(
                summary=f"The report claims {facts['claimed']:g}% and the plans support {figure:g}%."))
        raise AssertionError(text_format)


