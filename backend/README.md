# WCA assistant backend

FastAPI + Poetry, adapted from the architecture of `mayaawwadd/digital-human`.
The first version uses Azure OpenAI for answers and embeddings, and local SQLite
for extracted document chunks and vectors. It does not use the telecom database.

```sh
cd backend
poetry install
poetry run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Fill in `.env` locally using `.env.example`. Never place the Azure key in Next.js
or a `NEXT_PUBLIC_*` variable. Existing deployments: `gpt-4.1-mini` (chat),
`signal-embeddings` (embeddings). The Azure v1 endpoint does not need a dated API version.

In another terminal run the frontend on port 3000. Its default backend URL is
`http://127.0.0.1:8000`; override with `NEXT_PUBLIC_API_BASE_URL` if necessary.
Open the chat and expand **Reference documents** to upload PDF, TXT, or Markdown.

## API

- `GET /health`: local health/configuration flag; no paid model call.
- `GET /documents`: indexed documents.
- `POST /documents`: multipart `file`, <=10 MB, <=150 PDF pages, <=200 chunks.
- `DELETE /documents/{id}`: remove a document and its chunks from the index.
- `POST /chat`: `message`, bounded user/assistant `history`, current `context`
  (`source=browser-demo`, date, summaries, venue/obligation/issue/decision/forecast
  records), optional `document_ids`; returns `reply`, verified source IDs with
  excerpts/page references, and warnings. An empty document filter searches all.

PDFs need an extractable text layer; scanned PDFs require OCR before upload.
Only extracted text and embeddings are retained in `backend/data/`; binaries
are not retained. Re-uploading identical content with the same embedding
profile does not make another embedding call. Uploads are references for chat;
they do not change the simulated compliance-intake workflow or validate obligations.

Documents and selected passages are sent to Azure for embeddings/answers. Answers
use `store=False`. Programme state remains browser-supplied demo data, not trusted
production data. Retrieved passages and chat history cannot authorise actions.
The assistant cannot change decisions, gates, or evidence status.

This is a local, single-user prototype. Bind to loopback. Add authentication,
user-specific document access, shared programme storage, request limits and a
production deployment before exposing it publicly. GitHub Pages only hosts the
frontend; it cannot host this Python service or reach your private laptop remotely.

```sh
poetry run pytest
poetry run python -m scripts.check_azure  # makes small paid Azure requests
poetry run ruff check app tests
```
