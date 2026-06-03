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

    groq_api_key: str = ""
    gemini_api_key: str = ""

    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_server: str = "smtp.gmail.com"
    mail_port: int = 587
    frontend_url: str = "http://localhost:5173"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/calendar/callback"

    # Google reCAPTCHA — defaults are Google's official test keys (always pass)
    recaptcha_secret_key: str = "6LeIxAcTAAAAAGG-vFI1TnRWxMIksjbgpeBS8bJ8"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
