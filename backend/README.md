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

## Answer presentation and grounding

The chat opens at a wider desktop size and supports Expand/Restore. On mobile it
uses the available viewport. Supporting sources are typed cards: forecast dates,
probabilities and schedule margins; separate overall/gate readiness; met/unmet
conditions; or document excerpts with page numbers. Programme sources no longer
send raw JSON as an excerpt.

The model receives a labelled metric catalogue. Its structured numeric claims
are checked against the cited scope. Explicit percentages and day counts are
checked against cited metrics, allowing normal display rounding, or quoted
numbers in a cited document excerpt. A rejected draft gets one correction retry;
if that also fails, the response shows labelled source facts and a warning.
This is a narrow numerical safeguard, not verification of every sentence, date,
document interpretation, or causal explanation. Instructions distinguish observed
gate blockers from causal forecast drivers; a narrow guard also rejects the
unsupported readiness/float-causality pattern found during testing.


Explicit English questions of the form “Why is [venue] at risk/late/behind?”
receive a source-based summary composed from that venue's current forecast and
gate records. This read-only workflow intentionally does not ask the model to
infer physical delivery progress, obligation criticality, or causal drivers.
Other questions continue through Azure with the numerical checks described above.


The English quick questions “Which venue is highest risk?” and “Which critical
obligations are unverified?” use exact snapshot queries before retrieval or model
generation. Risk ranks by on-time probability, then greatest P80 delay, reporting
exact ties. Unverified Critical obligations filter the actual classification and
status, not gate blocker lists. Named venue scopes use the venue name, city or ID.
These answers are repeatable for the same snapshot and do not spend model tokens.
