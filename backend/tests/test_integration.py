from fastapi.testclient import TestClient

from app.main import app
from app.services.analysis import analysis_service


client = TestClient(app)


def test_analysis_pipeline_runs(monkeypatch):
    monkeypatch.setattr(analysis_service.repository, "fetch_live_pm25", lambda: None)
    response = client.post(
        "/api/analysis/run",
        json={
            "studyArea": "Bangkok Metropolitan Area",
            "weights": {"greenness": 45, "pm25": 35, "distance": 20},
            "filters": {"minimumGreenness": 0, "maximumPm25": 100, "minimumDistanceFromSource": 0},
            "chosenLayers": ["ndvi", "pm25", "greenSpaces", "pollutionSources", "suitability"],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["studyArea"] == "Bangkok Metropolitan Area"
    assert payload["rankedFeatures"]
    assert "suitabilityGrid" in payload["layers"]
