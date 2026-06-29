from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str = "postgresql://research:research@localhost:5432/research_assistant"
    upload_dir: str = "./data/uploads"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    secret_key: str = "change-me-in-production"
    log_level: str = "INFO"
    api_url: str = "http://localhost:8000"


settings = Settings()
