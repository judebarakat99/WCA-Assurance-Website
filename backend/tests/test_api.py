import io
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from pypdf import PdfWriter

from app.config import Settings
from app.documents import DocumentError, DocumentStore, chunk_pages, extract_pages
from app.main import create_app
from app.schemas import ModelAnswer


class FakeModels:
    embedding_profile = "fake:2"

    def __init__(self, settings):
        self.settings = settings
        self.embedding_calls = 0
        self.last_prompt = None

    async def embed(self, texts):
        self.embedding_calls += 1
        return [[1.0, 0.0] for _ in texts]

    def require_client(self):
        return SimpleNamespace(responses=self)

    async def parse(self, **kwargs):
        self.last_prompt = kwargs
        return SimpleNamespace(
            output_parsed=ModelAnswer(
                reply="The demo reports 54% assured readiness.",
                source_ids=["P", "D1", "invented"],
                claims=[{"source_id": "P", "metric": "programme_assured_pct", "value": 54}],
            )
        )

    async def close(self):
        pass


@pytest.fixture
def environment(tmp_path):
    settings = Settings(
        _env_file=None,
        azure_openai_endpoint="https://example.openai.azure.com",
        azure_openai_api_key=SecretStr("test-key"),
        data_dir=tmp_path,
        max_upload_bytes=1000,
    )
    models = FakeModels(settings)
    store = DocumentStore(tmp_path)
    with TestClient(create_app(settings, models, store)) as client:
        yield client, models, store


def request_body():
    return {
        "message": "What is assured readiness?",
        "context": {"as_of": "2026-11-05", "summary": {"assured": 0.54}},
    }


def test_chat_sources_are_checked_and_model_storage_is_disabled(environment):
    client, models, _ = environment
    response = client.post("/chat", json=request_body())
    assert response.status_code == 200
    assert [s["id"] for s in response.json()["sources"]] == ["P"]
    assert response.json()["warnings"]
    assert models.last_prompt["store"] is False
    assert "untrusted" in models.last_prompt["instructions"].lower()


def test_upload_retrieval_duplicate_and_delete(environment):
    client, models, store = environment
    response = client.post(
        "/documents",
        files={"file": ("../requirements.md", b"Floodlighting shall provide at least 2500 lux.")},
    )
    assert response.status_code == 201
    document = response.json()
    assert document["name"] == "requirements.md"
    assert models.embedding_calls == 1
    duplicate = client.post(
        "/documents",
        files={"file": ("requirements.md", b"Floodlighting shall provide at least 2500 lux.")},
    )
    assert duplicate.json()["duplicate"] is True
    assert models.embedding_calls == 1
    chat = client.post("/chat", json=request_body())
    assert [s["id"] for s in chat.json()["sources"]] == ["P", "D1"]
    source = chat.json()["sources"][1]
    assert source["page"] == 1 and "2500" in source["excerpt"]
    assert client.delete(f"/documents/{document['id']}").status_code == 204
    assert client.get("/documents").json() == []
    assert store.search([1, 0], models.embedding_profile) == []


def test_upload_limits_and_invalid_documents_do_not_call_azure(environment):
    client, models, _ = environment
    assert client.post("/documents", files={"file": ("big.txt", b"a" * 1001)}).status_code == 413
    assert client.post("/documents", files={"file": ("script.exe", b"hello")}).status_code == 422
    assert client.post("/documents", files={"file": ("blank.txt", b"  ")}).status_code == 422
    assert client.post("/documents", files={"file": ("bad.pdf", b"not a PDF")}).status_code == 422
    assert models.embedding_calls == 0


def test_textless_pdf_and_page_preserving_chunks():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    stream = io.BytesIO()
    writer.write(stream)
    with pytest.raises(DocumentError, match="OCR"):
        extract_pages("scan.pdf", stream.getvalue())
    chunks = chunk_pages([(2, "a" * 2000), (4, "page four")])
    assert [chunk["page"] for chunk in chunks] == [2, 2, 4]


def test_missing_keys_health_and_origin_protection(tmp_path):
    settings = Settings(_env_file=None, data_dir=tmp_path)
    with TestClient(create_app(settings)) as client:
        assert client.get("/health").json()["azure_configured"] is False
        assert client.post("/chat", json=request_body()).status_code == 503
        assert (
            client.post(
                "/chat", json=request_body(), headers={"Origin": "https://untrusted.example"}
            ).status_code
            == 403
        )


def test_blank_questions_and_oversized_snapshots_rejected(environment):
    client, _, _ = environment
    body = request_body()
    body["message"] = "  "
    assert client.post("/chat", json=body).status_code == 422
    body = request_body()
    body["context"]["summary"] = {"text": "a" * 100_001}
    assert client.post("/chat", json=body).status_code == 422


def test_milestone_risk_ranks_probability_not_readiness():
    from app.chat import build_context
    from app.schemas import ProgrammeContext

    context = ProgrammeContext(
        as_of="2026-11-05",
        forecasts=[
            {"id": "NEO", "on_time_probability": 1.0, "days_beyond_milestone": -63},
            {"id": "JED", "on_time_probability": 0.31, "days_beyond_milestone": 36},
            {"id": "RUH", "on_time_probability": 0.52, "days_beyond_milestone": 78},
        ],
    )
    sections, _ = build_context(context)
    assert [r["id"] for r in sections["milestone_risk_ranking"]] == ["JED", "RUH", "NEO"]


def test_numerical_validation_retries_once_and_rejects_bad_answers(environment):
    client, models, _ = environment
    calls = []

    async def invalid_answer(**kwargs):
        calls.append(kwargs)
        return SimpleNamespace(
            output_parsed=ModelAnswer(
                reply="Assured readiness is 99%.",
                source_ids=["P"],
                claims=[{"source_id": "P", "metric": "programme_assured_pct", "value": 99}],
            )
        )

    models.parse = invalid_answer
    response = client.post("/chat", json=request_body())
    assert response.status_code == 200
    assert "supplied demo facts" in response.json()["reply"]
    assert "99%" not in response.json()["reply"]
    assert len(calls) == 2
    assert response.json()["warnings"]


def test_numerical_validation_accepts_a_corrected_retry(environment):
    client, models, _ = environment
    calls = []

    async def corrected_answer(**kwargs):
        calls.append(kwargs)
        value = 99 if len(calls) == 1 else 54
        return SimpleNamespace(
            output_parsed=ModelAnswer(
                reply=f"Assured readiness is {value}%.",
                source_ids=["P"],
                claims=[{"source_id": "P", "metric": "programme_assured_pct", "value": value}],
            )
        )

    models.parse = corrected_answer
    response = client.post("/chat", json=request_body())
    assert response.status_code == 200
    assert response.json()["reply"] == "Assured readiness is 54%."
    assert len(calls) == 2
