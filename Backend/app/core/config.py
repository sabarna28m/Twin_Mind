from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TwinMind API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]

    secret_key: str = "change-me-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
