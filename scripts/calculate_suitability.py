from backend.app.models.schemas import AnalysisRequest
from backend.app.services.analysis import analysis_service


if __name__ == "__main__":
    result = analysis_service.run_analysis(AnalysisRequest())
    print(f"Calculated suitability for {result.suitabilityMapMetadata['gridCellCount']} cells")

