from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Green & Clean Bangkok Finder API"
    data_root: str = str(Path(__file__).resolve().parents[3] / "data")
    target_crs: str = "EPSG:32647"
    grid_size_meters: int = 2500
    use_live_pm25: bool = True
    air4thai_region_url: str = "http://air4thai.pcd.go.th/services/getNewAQI_JSON.php?region=1"
    air4thai_timeout_seconds: float = 5.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
