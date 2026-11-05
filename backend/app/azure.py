from openai import AsyncOpenAI

from .config import Settings


class AzureModels:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = None
        if settings.configured:
            self.client = AsyncOpenAI(
                api_key=settings.azure_openai_api_key.get_secret_value(),
                base_url=settings.azure_openai_endpoint.rstrip("/") + "/openai/v1/",
                timeout=45.0,
                max_retries=1,
            )

    def require_client(self) -> AsyncOpenAI:
        if self.client is None:
            raise RuntimeError("Azure endpoint and API key are not configured")
        return self.client

    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self.require_client().embeddings.create(
            model=self.settings.azure_openai_embedding_deployment_name,
            input=texts,
            dimensions=self.settings.azure_openai_embedding_dimensions,
        )
        vectors = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
        if len(vectors) != len(texts):
            raise RuntimeError("Embedding response was incomplete")
        return vectors

    @property
    def embedding_profile(self) -> str:
        return f"{self.settings.azure_openai_embedding_deployment_name}:{self.settings.azure_openai_embedding_dimensions}"

    async def close(self):
        if self.client:
            await self.client.close()
