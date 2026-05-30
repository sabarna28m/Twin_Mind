from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "TwinMind API"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"


settings = Settings()
