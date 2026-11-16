import asyncio
import hashlib
import json
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    RateLimitError,
)

from .azure import AzureModels
from .chat import answer_question
from .config import get_settings
from .documents import DocumentError, DocumentStore, chunk_pages, extract_pages
from .intake import ELEMENTS, IntakeStore, classify, load_stadiums, verify
from .schemas import ChatRequest, ChatResponse, Decision, Filing


def create_app(settings=None, models=None, store=None):
    settings = settings or get_settings()
    models = models or AzureModels(settings)
    store = store or DocumentStore(settings.data_dir)
    upload_lock = asyncio.Lock()
    chat_slots = asyncio.Semaphore(2)
    ai_slots = asyncio.Semaphore(4)
    intake = IntakeStore(store)
    stadiums = load_stadiums(settings.repo_data_dir)
    stadium_by_id = {s["id"]: s for s in stadiums}

    @asynccontextmanager
    async def lifespan(app):
        yield
        await models.close()

    app = FastAPI(title="WCA Assurance Assistant", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def local_origin_guard(request: Request, call_next):
        # This first version is local and unauthenticated; reject cross-origin
        # browser writes instead of treating CORS alone as access control.
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin not in settings.cors_origins
        ):
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Origin is not allowed"}, status_code=403)
        return await call_next(request)

    @app.exception_handler(AuthenticationError)
    async def authentication_error(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"detail": "Azure authentication failed. Check backend/.env."}, status_code=503
        )

    @app.exception_handler(RateLimitError)
    async def rate_error(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"detail": "Azure quota or rate limit reached. Try again later."}, status_code=429
        )

    @app.exception_handler(APIStatusError)
    async def upstream_error(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {
                "detail": "Azure could not complete the request. Verify the deployment and configuration."
            },
            status_code=502,
        )

    @app.exception_handler(APIConnectionError)
    async def connection_error(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(
            {"detail": "Could not reach Azure. Check the network and endpoint."}, status_code=502
        )

    @app.exception_handler(APITimeoutError)
    async def timeout_error(request, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": "Azure timed out. Please try again."}, status_code=504)

    def require_configuration():
        if not settings.configured:
            raise HTTPException(503, "Fill in the Azure endpoint and key in backend/.env first.")

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "azure_configured": settings.configured,
            "documents": len(store.list_documents()),
        }

    @app.get("/documents")
    async def documents():
        return store.list_documents()

    async def read_upload(file: UploadFile):
        try:
            content = await file.read(settings.max_upload_bytes + 1)
        finally:
            await file.close()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(413, "Document exceeds the 10 MB limit")
        return Path((file.filename or "document").replace("\\", "/")).name[:180], content

    async def ingest(name: str, content: bytes):
        """Extract, chunk and embed a document; returns (document, pages)."""
        try:
            pages = await asyncio.to_thread(extract_pages, name, content)
            chunks = chunk_pages(pages)
        except DocumentError as exc:
            raise HTTPException(422, str(exc)) from exc
        async with upload_lock:
            duplicate = store.find_duplicate(
                hashlib.sha256(content).hexdigest(), models.embedding_profile
            )
            if duplicate:
                return {**duplicate, "duplicate": True}, pages
            if len(store.list_documents()) >= 30:
                raise HTTPException(
                    422, "Local prototype supports 30 documents. Remove an unused document first."
                )
            vectors = []
            for start in range(0, len(chunks), 16):
                vectors.extend(await models.embed([c["text"] for c in chunks[start : start + 16]]))
            document = store.add(name, content, chunks, vectors, models.embedding_profile, pages)
            return {**document, "duplicate": False}, pages

    @app.post("/documents", status_code=201)
    async def upload_document(file: UploadFile = File(...)):
        require_configuration()
        name, content = await read_upload(file)
        document, _ = await ingest(name, content)
        return document

    @app.delete("/documents/{identifier}", status_code=204)
    async def remove_document(identifier: str):
        if not store.delete(identifier):
            raise HTTPException(404, "Document not found")

    @app.post("/chat", response_model=ChatResponse)
    async def chat(request: ChatRequest):
        require_configuration()
        async with chat_slots:
            try:
                return await answer_question(request, models, store)
            except RuntimeError as exc:
                raise HTTPException(
                    502,
                    "The assistant could not verify this answer against the supplied data. Please try again or ask a narrower question.",
                ) from exc

    # ---------------------------------------------------------------- intake

    def intake_state():
        return {
            "stadiums": stadiums,
            "elements": [{"id": k, "name": v} for k, v in ELEMENTS.items()],
            "documents": intake.documents(),
            "checks": intake.checks(),
        }

    def intake_row(identifier):
        row = next((d for d in intake.documents() if d["document_id"] == identifier), None)
        if not row:
            raise HTTPException(404, "Document not found in intake")
        return row

    @app.get("/intake")
    async def get_intake():
        return intake_state()

    @app.post("/intake/documents", status_code=201)
    async def intake_upload(file: UploadFile = File(...)):
        """Upload a contractor document; the agent proposes how to file it."""
        require_configuration()
        name, content = await read_upload(file)
        document, pages = await ingest(name, content)
        existing = intake.document(document["id"])
        if existing:
            return {**intake_row(document["id"]), "duplicate": True}
        async with ai_slots:
            try:
                proposal = await classify(models, stadiums, name, pages)
            except RuntimeError:
                proposal = None
        intake.propose(document["id"], proposal)
        return {**intake_row(document["id"]), "duplicate": document["duplicate"]}

    @app.post("/intake/documents/{identifier}/file")
    async def intake_file(identifier: str, filing: Filing):
        """A person confirms (or corrects) the proposal and files the document."""
        intake_row(identifier)
        if filing.stadium_id not in stadium_by_id:
            raise HTTPException(422, "Unknown stadium")
        if filing.kind == "detailed-plan" and not filing.element:
            raise HTTPException(422, "A detailed plan needs a scope element")
        intake.file(
            identifier,
            filing.kind,
            filing.stadium_id,
            filing.element if filing.kind == "detailed-plan" else None,
            filing.as_of,
            filing.revision,
        )
        return intake_row(identifier)

    @app.post("/intake/checks/{stadium_id}")
    async def intake_verify(stadium_id: str):
        """Recalculate a stadium's progress from its filed plans and compare with the claim."""
        require_configuration()
        if stadium_id not in stadium_by_id:
            raise HTTPException(404, "Unknown stadium")
        try:
            result = await verify(models, intake, stadium_by_id[stadium_id], ai_slots)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        intake.save_check(stadium_id, result)
        return intake.checks()[stadium_id]

    @app.post("/intake/checks/{stadium_id}/decision")
    async def intake_decide(stadium_id: str, decision: Decision):
        """A reviewer accepts or rejects the agent's finding."""
        if not intake.decide(stadium_id, decision.decision, decision.note):
            raise HTTPException(404, "No check for this stadium")
        return intake.checks()[stadium_id]

    @app.post("/intake/seed")
    async def intake_seed():
        """File the preloaded sample documents and check their stadiums."""
        require_configuration()
        folder = settings.repo_data_dir / "progress" / "preloaded"
        expected = json.loads((settings.repo_data_dir / "progress" / "expected.json").read_text())
        seeded = []
        for path in sorted(folder.glob("*/*.pdf")):
            stadium_id = path.parent.name
            document, _ = await ingest(path.name, path.read_bytes())
            match = re.search(r"-(" + "|".join(ELEMENTS) + r")-plan-rev-(\w+)\.pdf$", path.name)
            if not intake.document(document["id"]):
                intake.propose(document["id"], None)
            intake.file(
                document["id"],
                "detailed-plan" if match else "progress-report",
                stadium_id,
                match[1] if match else None,
                expected["as_of"],
                match[2] if match else None,
            )
            if stadium_id not in seeded:
                seeded.append(stadium_id)
        for stadium_id in seeded:
            intake.save_check(
                stadium_id, await verify(models, intake, stadium_by_id[stadium_id], ai_slots)
            )
        return intake_state()

    @app.delete("/intake", status_code=204)
    async def intake_clear():
        """Remove every intake document and check (demo reset)."""
        intake.clear()

    return app


app = create_app()
