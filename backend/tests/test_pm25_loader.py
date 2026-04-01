import httpx
import pandas as pd

from app.services.data_loader import DataRepository


def test_map_air4thai_station_extracts_expected_fields():
    repository = DataRepository()
    station = {
        "stationID": "02t",
        "nameTH": "ทดสอบ",
        "nameEN": "Test Station",
        "areaEN": "Bangkok",
        "stationType": "GROUND",
        "lat": "13.732846",
        "long": "100.487662",
        "AQILast": {
            "date": "2026-03-31",
            "time": "16:00",
            "PM25": {"value": "15.8"},
        },
    }

    mapped = repository._map_air4thai_station(station)

    assert mapped == {
        "id": "02t",
        "name": "Test Station",
        "area": "Bangkok",
        "stationType": "GROUND",
        "latitude": 13.732846,
        "longitude": 100.487662,
        "pm25": 15.8,
        "timestamp": "2026-03-31 16:00",
        "source": "Air4Thai",
    }


def test_fetch_live_pm25_returns_none_on_http_failure(monkeypatch):
    repository = DataRepository()

    class DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx, "Client", lambda timeout: DummyClient())

    assert repository.fetch_live_pm25() is None


def test_fetch_live_pm25_filters_invalid_rows(monkeypatch):
    repository = DataRepository()

    class DummyResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "stations": [
                    {
                        "stationID": "valid",
                        "nameEN": "Valid Station",
                        "lat": "13.7",
                        "long": "100.5",
                        "AQILast": {"date": "2026-03-31", "time": "17:00", "PM25": {"value": "22.5"}},
                    },
                    {
                        "stationID": "invalid",
                        "nameEN": "Invalid Station",
                        "lat": "13.8",
                        "long": "100.6",
                        "AQILast": {"date": "2026-03-31", "time": "17:00", "PM25": {"value": "-1"}},
                    },
                ]
            }

    class DummyClient:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url):
            return DummyResponse()

    monkeypatch.setattr(httpx, "Client", lambda timeout: DummyClient())

    frame = repository.fetch_live_pm25()

    assert isinstance(frame, pd.DataFrame)
    assert frame["id"].tolist() == ["valid"]
    assert frame["pm25"].tolist() == [22.5]
