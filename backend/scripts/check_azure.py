"""One small chat request and one embedding request; never print secrets."""

import asyncio

from openai import APIError

from app.azure import AzureModels
from app.chat import answer_question
from app.config import get_settings
from app.documents import DocumentStore
from app.schemas import ChatRequest


async def main():
    settings = get_settings()
    print(f"Azure configuration present: {settings.configured}")
    if not settings.configured:
        return
    models = AzureModels(settings)
    try:
        vector = (await models.embed(["WCA connectivity test"]))[0]
        print(f"Embedding connection: OK ({len(vector)} dimensions)")
        # Use an empty temporary index so existing user documents are never sent by this check.
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as directory:
            reply = await answer_question(
                ChatRequest(
                    message="What assured readiness does the supplied demo report?",
                    context={"as_of": "2026-11-05", "summary": {"assured": 0.54}},
                ),
                models,
                DocumentStore(Path(directory)),
            )
            print(f"Chat connection: OK ({len(reply.sources)} validated source references)")
    except APIError as exc:
        print(
            f"Azure connection failed: {type(exc).__name__}; HTTP status {getattr(exc, 'status_code', 'unavailable')}"
        )
        raise SystemExit(1) from None
    except Exception as exc:
        print(f"Connection check failed: {type(exc).__name__}")
        raise SystemExit(1) from None
    finally:
        await models.close()


if __name__ == "__main__":
    asyncio.run(main())
