from pathlib import Path

from backend.app.config.settings import get_settings


def main() -> None:
    settings = get_settings()
    root = Path(settings.data_root)
    required_dirs = ["boundaries", "green_spaces", "pollution", "pm25", "rasters", "output"]
    for directory in required_dirs:
        path = root / directory
        print(f"{directory}: {'OK' if path.exists() else 'MISSING'}")


if __name__ == "__main__":
    main()

