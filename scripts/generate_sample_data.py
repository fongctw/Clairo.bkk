from pathlib import Path

from backend.app.config.settings import get_settings
from backend.app.utils.mock_data import ensure_sample_files


if __name__ == "__main__":
    settings = get_settings()
    ensure_sample_files(Path(settings.data_root))
    print(f"Sample data ready at {settings.data_root}")

