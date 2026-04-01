from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.models.schemas import AnalysisRequest, AnalysisResponse
from app.services.analysis import analysis_service

router = APIRouter()


@router.get("/health")
def health() -> dict:
    result = analysis_service.get_latest_result()
    return {
        "status": "ok",
        "studyArea": result.studyArea,
        "outputFiles": result.outputFiles,
        "layerCount": len(result.layers),
    }


@router.get("/study-areas")
def study_areas() -> list[dict[str, str]]:
    gdf = analysis_service.repository.load_study_areas().to_crs("EPSG:4326")
    return [{"id": str(row.get("id", index)), "name": str(row["name"])} for index, row in gdf.iterrows()]


@router.get("/layers")
def layers() -> dict:
    return {
        "catalog": analysis_service.get_layer_catalog(),
        "data": analysis_service.get_latest_result().layers,
    }


@router.post("/analysis/run", response_model=AnalysisResponse)
def run_analysis(request: AnalysisRequest) -> AnalysisResponse:
    return analysis_service.run_analysis(request)


@router.get("/analysis/result", response_model=AnalysisResponse)
def analysis_result() -> AnalysisResponse:
    return analysis_service.get_latest_result()


@router.get("/rankings")
def rankings() -> list[dict]:
    return [item.model_dump() for item in analysis_service.get_rankings()]


@router.get("/export/geojson")
def export_geojson() -> FileResponse:
    result = analysis_service.get_latest_result()
    return FileResponse(result.outputFiles["geojson"], media_type="application/geo+json", filename="suitability.geojson")


@router.get("/export/csv")
def export_csv() -> FileResponse:
    result = analysis_service.get_latest_result()
    return FileResponse(result.outputFiles["csv"], media_type="text/csv", filename="rankings.csv")

