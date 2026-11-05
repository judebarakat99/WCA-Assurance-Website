import hashlib
import io
import json
import math
import sqlite3
from pathlib import Path
from uuid import uuid4

from pypdf import PdfReader


class DocumentError(ValueError):
    pass


def extract_pages(filename: str, content: bytes) -> list[tuple[int, str]]:
    suffix = Path(filename).suffix.lower()
    if suffix in {".txt", ".md"}:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise DocumentError("Text documents must use UTF-8 encoding") from exc
        pages = [(1, text)]
    elif suffix == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                raise DocumentError("Password-protected PDFs are not supported")
            if len(reader.pages) > 150:
                raise DocumentError("Upload a PDF with at most 150 pages")
            pages = [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
        except DocumentError:
            raise
        except Exception as exc:
            raise DocumentError("The PDF could not be read") from exc
    else:
        raise DocumentError("Supported document types are PDF, TXT, and Markdown")
    pages = [(page, text.strip()) for page, text in pages if text.strip()]
    if not pages:
        raise DocumentError("No readable text was found. Scanned PDFs need OCR before upload")
    if sum(len(text) for _, text in pages) > 300_000:
        raise DocumentError("Document text exceeds 300,000 characters; upload a smaller section")
    return pages


def chunk_pages(pages: list[tuple[int, str]], size: int = 1800, overlap: int = 200):
    chunks = []
    for page, text in pages:
        for start in range(0, len(text), size - overlap):
            part = text[start : start + size].strip()
            if part:
                chunks.append({"page": page, "text": part})
            if start + size >= len(text):
                break
    if len(chunks) > 200:
        raise DocumentError("Document exceeds 200 text chunks; upload a smaller section")
    return chunks


def cosine(left, right):
    if len(left) != len(right):
        return -1.0
    denominator = math.sqrt(sum(v * v for v in left) * sum(v * v for v in right))
    return sum(a * b for a, b in zip(left, right)) / denominator if denominator else 0.0


class DocumentStore:
    def __init__(self, directory: Path):
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True)
        self.database = directory / "documents.sqlite3"
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, hash TEXT NOT NULL,
                    profile TEXT NOT NULL, pages INTEGER NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(hash, profile)
                );
                CREATE TABLE IF NOT EXISTS chunks (
                    document_id TEXT NOT NULL, page INTEGER NOT NULL,
                    text TEXT NOT NULL, embedding TEXT NOT NULL,
                    FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
                );
            """)

    def connect(self):
        db = sqlite3.connect(self.database)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def list_documents(self):
        with self.connect() as db:
            return [
                dict(row)
                for row in db.execute(
                    "SELECT id,name,pages,created_at FROM documents ORDER BY created_at DESC"
                )
            ]

    def find_duplicate(self, digest, profile):
        with self.connect() as db:
            row = db.execute(
                "SELECT id,name,pages,created_at FROM documents WHERE hash=? AND profile=?",
                (digest, profile),
            ).fetchone()
            return dict(row) if row else None

    def add(self, name, content, chunks, vectors, profile):
        digest = hashlib.sha256(content).hexdigest()
        existing = self.find_duplicate(digest, profile)
        if existing:
            return existing
        identifier = str(uuid4())
        with self.connect() as db:
            db.execute(
                "INSERT INTO documents(id,name,hash,profile,pages) VALUES(?,?,?,?,?)",
                (identifier, name, digest, profile, len({c["page"] for c in chunks})),
            )
            db.executemany(
                "INSERT INTO chunks VALUES(?,?,?,?)",
                [
                    (identifier, c["page"], c["text"], json.dumps(v))
                    for c, v in zip(chunks, vectors, strict=True)
                ],
            )
        # Store only extracted text and vectors; uploaded binary files are not retained.
        return next(d for d in self.list_documents() if d["id"] == identifier)

    def search(self, vector, profile, document_ids=None, limit=6):
        query = "SELECT c.*,d.name FROM chunks c JOIN documents d ON c.document_id=d.id WHERE d.profile=?"
        parameters = [profile]
        if document_ids:
            query += " AND d.id IN (" + ",".join("?" for _ in document_ids) + ")"
            parameters.extend(document_ids)
        with self.connect() as db:
            rows = [dict(row) for row in db.execute(query, parameters)]
        for row in rows:
            row["similarity"] = cosine(vector, json.loads(row.pop("embedding")))
        return sorted(rows, key=lambda row: row["similarity"], reverse=True)[:limit]

    def delete(self, identifier):
        with self.connect() as db:
            return db.execute("DELETE FROM documents WHERE id=?", (identifier,)).rowcount > 0
