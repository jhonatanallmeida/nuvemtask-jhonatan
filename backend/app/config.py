from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret_key: str
    token_expiration_minutes: int
    admin_email: str
    cors_origins: tuple[str, ...]


def load_settings() -> Settings:
    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return Settings(
        database_url=os.getenv("DATABASE_URL", "sqlite:///./nuvemtask.db"),
        jwt_secret_key=os.getenv(
            "JWT_SECRET_KEY", "local-development-secret-change-before-deploy"
        ),
        token_expiration_minutes=int(os.getenv("TOKEN_EXPIRATION_MINUTES", "60")),
        admin_email=os.getenv("ADMIN_EMAIL", "").strip().lower(),
        cors_origins=tuple(origin.strip() for origin in origins.split(",") if origin.strip()),
    )


settings = load_settings()
