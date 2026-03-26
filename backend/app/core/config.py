from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GEMINI_LIVE_MODEL: str = "gemini-live-2.5-flash-preview"
    GEMINI_HR_VOICE: str = "Aoede"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()