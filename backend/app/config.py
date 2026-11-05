from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    azure_openai_endpoint: str = ""
    azure_openai_api_key: SecretStr = SecretStr("")
    azure_openai_deployment_name: str = "gpt-4.1-mini"
    azure_openai_embedding_deployment_name: str = "signal-embeddings"
    azure_openai_embedding_dimensions: int = 1536
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    data_dir: Path = BACKEND_DIR / "data"
    max_upload_bytes: int = 10 * 1024 * 1024

    @property
    def configured(self) -> bool:
        key = self.azure_openai_api_key.get_secret_value()
        return (
            self.azure_openai_endpoint.startswith("https://")
            and "YOUR-" not in self.azure_openai_endpoint
            and bool(key)
            and "PASTE_" not in key
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
