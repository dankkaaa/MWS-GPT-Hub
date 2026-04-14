import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


_load_dotenv()


@dataclass(frozen=True)
class Settings:
    mws_api_key: str = os.getenv("MWS_API_KEY", "")
    mws_base_url: str = os.getenv("MWS_BASE_URL", "https://api.gpt.mws.ru")
    request_timeout_seconds: int = int(os.getenv("MWS_TIMEOUT_SECONDS", "60"))
    image_request_timeout_seconds: int = int(os.getenv("MWS_IMAGE_TIMEOUT_SECONDS", "600"))
    verify_ssl: bool = os.getenv("MWS_VERIFY_SSL", "true").lower() in {"1", "true", "yes", "on"}


settings = Settings()
