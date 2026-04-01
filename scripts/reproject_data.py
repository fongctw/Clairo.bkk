from pathlib import Path

import geopandas as gpd

from backend.app.config.settings import get_settings


def main() -> None:
    settings = get_settings()
    target_crs = settings.target_crs
    for folder in ["boundaries", "green_spaces", "pollution"]:
        for path in (Path(settings.data_root) / folder).glob("*.geojson"):
            gdf = gpd.read_file(path)
            if gdf.crs is None:
                gdf = gdf.set_crs("EPSG:4326")
            gdf.to_crs(target_crs).to_file(path, driver="GeoJSON")
            print(f"Reprojected {path.name} -> {target_crs}")


if __name__ == "__main__":
    main()

