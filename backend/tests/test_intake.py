"""Intake and progress verification, end to end, with a stand-in model that
reads the generated sample PDFs the way the real model is asked to."""

import json
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app import progress_calc as calc
from app.config import Settings
from app.documents import DocumentStore
from app.intake import PlanExtraction, check_plan, unsupported_numbers
from app.main import create_app
from scripts.sample_reader import SampleReader as FakeModels

DATA = Path(__file__).resolve().parents[2] / "data"
SAMPLES = DATA / "progress"
EXPECTED = json.loads((SAMPLES / "expected.json").read_text())
ORIGIN = {"Origin": "http://localhost:3000"}
def make(tmp_path, **kwargs):
    settings = Settings(
        _env_file=None, azure_openai_endpoint="https://example.openai.azure.com",
        azure_openai_api_key=SecretStr("test-key"), data_dir=tmp_path, repo_data_dir=DATA,
    )
    models = FakeModels(settings, **kwargs)
    return TestClient(create_app(settings, models, DocumentStore(tmp_path))), models


@pytest.fixture
def client(tmp_path):
    client, _ = make(tmp_path)
    with client:
        yield client


def upload(client, path):
    with path.open("rb") as f:
        response = client.post("/intake/documents", files={"file": (path.name, f, "application/pdf")}, headers=ORIGIN)
    assert response.status_code == 201, response.text
    return response.json()


def file_as_proposed(client, doc):
    body = {k: doc[k] for k in ("kind", "stadium_id", "element", "as_of", "revision")}
    response = client.post(f"/intake/documents/{doc['document_id']}/file", json=body, headers=ORIGIN)
    assert response.status_code == 200, response.text
    return response.json()


def test_planned_fraction_builds_up_evenly():
    start, finish = date(2026, 11, 1), date(2026, 11, 30)
    assert calc.planned_fraction(start, finish, date(2026, 10, 31)) == 0
    assert calc.planned_fraction(start, finish, date(2026, 11, 15)) == 0.5
    assert calc.planned_fraction(start, finish, date(2026, 11, 30)) == 1


def test_seed_matches_expected_results(client):
    state = client.post("/intake/seed", headers=ORIGIN).json()
    assert len(state["documents"]) == 9
    for stadium_id in ("aramco", "prince-faisal-bin-fahad"):
        check, want = state["checks"][stadium_id], EXPECTED["stadiums"][stadium_id]
        assert check["recalculated"] == want["overall_actual"]
        assert check["planned"] == want["overall_planned"]
        assert check["summary_checked"] and not check["stale"]
    assert state["checks"]["aramco"]["status"] == "supported"
    assert state["checks"]["prince-faisal-bin-fahad"]["status"] == "behind-plan"


def test_upload_classify_file_and_flag_overstated_claim(client):
    folder = SAMPLES / "to-upload" / "king-fahad-sports-city"
    docs = [upload(client, p) for p in sorted(folder.glob("*.pdf"))]
    assert all(d["status"] == "proposed" and d["confidence"] == "high" for d in docs)
    for d in docs:
        file_as_proposed(client, d)
    check = client.post("/intake/checks/king-fahad-sports-city", headers=ORIGIN).json()
    want = EXPECTED["stadiums"]["king-fahad-sports-city"]
    assert check["status"] == "overstated"
    assert check["claimed"] == 70 and check["recalculated"] == want["overall_actual"]
    flood = next(p for p in check["packages"] if p["element"] == "floodlighting")
    assert flood["claimed"] == 75 and flood["status"] == "overstated"
    assert all(a["page"] == 1 for a in flood["activities"])

    # A newer floodlighting plan supersedes the old one and marks the check out of date.
    revised = file_as_proposed(client, upload(client, SAMPLES / "revised" / EXPECTED["revised"]["file"]))
    state = client.get("/intake").json()
    assert state["checks"]["king-fahad-sports-city"]["stale"]
    old = next(d for d in state["documents"] if d["name"].endswith("floodlighting-plan-rev-C.pdf"))
    assert old["superseded"] == 1 and revised["superseded"] == 0
    check = client.post("/intake/checks/king-fahad-sports-city", headers=ORIGIN).json()
    flood = next(p for p in check["packages"] if p["element"] == "floodlighting")
    assert flood["actual"] == EXPECTED["revised"]["actual"]
    assert check["status"] == "overstated" and not check["stale"]

    decided = client.post(
        "/intake/checks/king-fahad-sports-city/decision", json={"decision": "accepted"}, headers=ORIGIN
    ).json()
    assert decided["decision"] == "accepted"


def test_missing_plan_is_reported(client):
    folder = SAMPLES / "to-upload" / "king-fahad-sports-city"
    for p in sorted(folder.glob("*.pdf")):
        if "broadcast" not in p.name:
            file_as_proposed(client, upload(client, p))
    check = client.post("/intake/checks/king-fahad-sports-city", headers=ORIGIN).json()
    missing = next(p for p in check["packages"] if p["element"] == "broadcast-media")
    assert missing["status"] == "evidence-missing" and missing["actual"] is None
    assert any(not s["ok"] and s["label"] == "Missing evidence" for s in check["steps"])


def test_misread_figure_is_caught_and_reread(tmp_path):
    client, models = make(tmp_path, misread=True)
    with client:
        folder = SAMPLES / "preloaded" / "aramco"
        for p in sorted(folder.glob("*.pdf")):
            file_as_proposed(client, upload(client, p))
        check = client.post("/intake/checks/aramco", headers=ORIGIN).json()
    assert check["recalculated"] == EXPECTED["stadiums"]["aramco"]["overall_actual"]
    assert any("Re-read once" in s["detail"] for s in check["steps"])


def test_summary_with_unsupported_figure_falls_back(tmp_path):
    client, _ = make(tmp_path, inflate_summary=True)
    with client:
        client.post("/intake/seed", headers=ORIGIN)
        check = client.get("/intake").json()["checks"]["aramco"]
    assert not check["summary_checked"]
    assert "99" not in check["summary"]


def test_page_checks_and_number_guard():
    plan = PlanExtraction(as_of="2026-11-15", budget=95, budget_page=1, activities=[
        {"ref": "X-01", "name": "A", "weight": 100, "start": "2026-01-01", "finish": "2026-02-01", "actual": 40, "page": 1}
    ])
    assert check_plan(plan, {1: "SAR 95 million\nX-01 A 100 01 Jan 2026 01 Feb 2026 40"}) == []
    assert check_plan(plan, {1: "SAR 95 million\nX-01 A 100 01 Jan 2026 01 Feb 2026 45"})
    assert unsupported_numbers("It is 52.1% done, not 70%.", {"52.1", "70"}) == []
    assert unsupported_numbers("It is 80% done.", {"52.1"}) == ["80"]


def test_unknown_stadium_and_clear(client):
    doc = upload(client, SAMPLES / "preloaded" / "aramco" / "ars-progress-report-2026-11.pdf")
    bad = {"kind": "progress-report", "stadium_id": "nowhere"}
    assert client.post(f"/intake/documents/{doc['document_id']}/file", json=bad, headers=ORIGIN).status_code == 422
    assert client.delete("/intake", headers=ORIGIN).status_code == 204
    assert client.get("/intake").json()["documents"] == []
