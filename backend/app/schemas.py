import json
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class ProgrammeContext(BaseModel):
    source: Literal["browser-demo"] = "browser-demo"
    as_of: str = Field(max_length=32)
    summary: dict[str, Any] = Field(default_factory=dict)
    venues: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    obligations: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    issues: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    decisions: list[dict[str, Any]] = Field(default_factory=list, max_length=100)
    forecasts: list[dict[str, Any]] = Field(default_factory=list, max_length=50)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[HistoryMessage] = Field(default_factory=list, max_length=12)
    context: ProgrammeContext
    document_ids: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question cannot be blank")
        return value.strip()

    @field_validator("context")
    @classmethod
    def bounded_context(cls, value: ProgrammeContext) -> ProgrammeContext:
        if len(json.dumps(value.model_dump(), ensure_ascii=False)) > 100_000:
            raise ValueError("Programme snapshot exceeds the 100,000 character limit")
        return value


class ModelAnswer(BaseModel):
    reply: str
    source_ids: list[str]


class Source(BaseModel):
    id: str
    kind: Literal["programme", "document"]
    title: str
    document_id: str | None = None
    page: int | None = None
    excerpt: str | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[Source]
    warnings: list[str] = Field(default_factory=list)
