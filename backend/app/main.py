import asyncio
import hashlib
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
from .schemas import ChatRequest, ChatResponse


def create_app(settings=None, models=None, store=None):
    settings = settings or get_settings()
    models = models or AzureModels(settings)
    store = store or DocumentStore(settings.data_dir)
    upload_lock = asyncio.Lock()
    chat_slots = asyncio.Semaphore(2)

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

    @app.post("/documents", status_code=201)
    async def upload_document(file: UploadFile = File(...)):
        require_configuration()
        try:
            content = await file.read(settings.max_upload_bytes + 1)
        finally:
            await file.close()
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(413, "Document exceeds the 10 MB limit")
        name = Path((file.filename or "document").replace("\\", "/")).name[:180]
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
                return {**duplicate, "duplicate": True}
            if len(store.list_documents()) >= 30:
                raise HTTPException(
                    422, "Local prototype supports 30 documents. Remove an unused document first."
                )
            vectors = []
            for start in range(0, len(chunks), 16):
                vectors.extend(await models.embed([c["text"] for c in chunks[start : start + 16]]))
            return {
                **store.add(name, content, chunks, vectors, models.embedding_profile),
                "duplicate": False,
            }

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

    return app


app = create_app()
