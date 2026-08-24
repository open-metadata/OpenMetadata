#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Regression coverage for sample-data DAG validation."""

import importlib.util
from pathlib import Path
from types import ModuleType
from urllib.parse import parse_qs, urlparse

import pytest

VALIDATE_COMPOSE_PATH = Path(__file__).resolve().parents[3] / "docker" / "validate_compose.py"


class FakeClock:
    """Deterministic clock for a validator polling cycle."""

    def __init__(self) -> None:
        self.now = 0.0

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


class FakeAirflowResponse:
    """Minimal response returned by the Airflow HTTP boundary."""

    def __init__(self, payload: dict[str, object], text: str = "", status_code: int = 200) -> None:
        self.payload = payload
        self.text = text
        self.status_code = status_code

    def json(self) -> dict[str, object]:
        return self.payload


class FakeTokenResponse:
    """Minimal token response returned by the Airflow authentication boundary."""

    status_code = 201

    def json(self) -> dict[str, str]:
        return {"access_token": "token"}


def load_validate_compose() -> ModuleType:
    """Load the Docker-executed validator without running its CLI entry point."""
    spec = importlib.util.spec_from_file_location("validate_compose_test_module", VALIDATE_COMPOSE_PATH)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_main_does_not_accept_historical_success_for_triggered_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The validator follows the specific run created by the startup script."""
    validator = load_validate_compose()
    requested_paths: list[str] = []

    def airflow_get(path: str, _timeout: float) -> FakeAirflowResponse:
        requested_paths.append(path)
        if path.endswith("manual__target"):
            return FakeAirflowResponse({"dag_run_id": "manual__target", "state": "failed"})
        if path.endswith("/dagRuns"):
            return FakeAirflowResponse(
                {
                    "dag_runs": [
                        {
                            "dag_run_id": "historical-success",
                            "logical_date": "2026-08-23T00:00:00Z",
                            "state": "success",
                        }
                    ]
                }
            )
        if path.endswith("taskInstances"):
            return FakeAirflowResponse({"task_instances": []})
        return FakeAirflowResponse({}, text="last task log")

    monkeypatch.setattr(validator, "airflow_get", airflow_get)
    monkeypatch.setenv("VALIDATE_COMPOSE_DAG_RUN_ID", "manual__target")
    monkeypatch.setenv("VALIDATE_COMPOSE_TIMEOUT_SECONDS", "240")

    with pytest.raises(SystemExit, match="DAG run state: failed"):
        validator.main()

    assert requested_paths[0] == "/api/v2/dags/sample_data/dagRuns/manual__target"
    assert "/api/v2/dags/sample_data/dagRuns" not in requested_paths


def test_get_last_run_info_filters_by_trigger_logical_date(monkeypatch: pytest.MonkeyPatch) -> None:
    """A malformed trigger response cannot fall back to unrelated historical runs."""
    validator = load_validate_compose()
    requested_paths: list[str] = []

    def airflow_get(path: str, _timeout: float) -> FakeAirflowResponse:
        requested_paths.append(path)
        return FakeAirflowResponse(
            {
                "dag_runs": [
                    {
                        "dag_run_id": "manual__target",
                        "logical_date": "2026-08-24T00:00:00Z",
                        "state": "queued",
                    }
                ]
            }
        )

    monkeypatch.setattr(validator, "airflow_get", airflow_get)

    assert validator.get_last_run_info(None, "2026-08-24T00:00:00Z") == ("manual__target", "queued", True)
    query = parse_qs(urlparse(requested_paths[0]).query)
    assert query == {
        "limit": ["1"],
        "order_by": ["-logical_date"],
        "logical_date_gte": ["2026-08-24T00:00:00Z"],
        "logical_date_lte": ["2026-08-24T00:00:00Z"],
    }


def test_retry_count_cannot_extend_the_forwarded_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """The shell's reserved diagnostic margin remains enforceable."""
    validator = load_validate_compose()

    monkeypatch.setenv("VALIDATE_COMPOSE_TIMEOUT_SECONDS", "240")
    monkeypatch.setenv("VALIDATE_COMPOSE_MAX_RETRIES", "60")

    assert validator.resolve_timeout_seconds(10) == 240


def test_timeout_keeps_last_observed_run_after_transient_poll_failure(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Timeout diagnostics retain and report the last run after a transient poll failure."""
    validator = load_validate_compose()
    clock = FakeClock()
    airflow_responses = iter(
        [
            FakeAirflowResponse(
                {
                    "dag_runs": [
                        {
                            "dag_run_id": "run-1",
                            "logical_date": "2026-08-24T00:00:00Z",
                            "state": "running",
                        }
                    ]
                }
            ),
            None,
            FakeAirflowResponse(
                {
                    "task_instances": [
                        {
                            "task_id": "ingest_using_recipe",
                            "state": "running",
                            "try_number": 1,
                            "start_date": "2026-08-24T00:00:00Z",
                            "end_date": None,
                            "duration": 1,
                        }
                    ]
                }
            ),
            FakeAirflowResponse({}, text="last task log"),
        ]
    )

    monkeypatch.setattr(validator, "time", clock)
    monkeypatch.setattr(validator, "airflow_get", lambda _path, _timeout: next(airflow_responses))
    monkeypatch.setenv("VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS", "1")
    monkeypatch.setenv("VALIDATE_COMPOSE_TIMEOUT_SECONDS", "1")
    monkeypatch.delenv("VALIDATE_COMPOSE_MAX_RETRIES", raising=False)

    with pytest.raises(SystemExit) as exit_info:
        validator.main()

    output = capsys.readouterr().out
    assert "Task instances for run-1:" in output
    assert "ingest_using_recipe: state=running" in output
    assert "last observed run=run-1, state=running" in str(exit_info.value)


def test_airflow_get_uses_remaining_timeout_after_authentication(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Authentication and the protected request share one caller-provided budget."""
    validator = load_validate_compose()
    clock = FakeClock()
    post_timeouts: list[float] = []
    get_timeouts: list[float] = []

    def post(*_args, **kwargs) -> FakeTokenResponse:
        post_timeouts.append(kwargs["timeout"])
        clock.now += 7
        return FakeTokenResponse()

    def get(*_args, **kwargs) -> FakeAirflowResponse:
        get_timeouts.append(kwargs["timeout"])
        return FakeAirflowResponse({})

    monkeypatch.setattr(validator, "time", clock)
    monkeypatch.setattr(validator.requests, "post", post)
    monkeypatch.setattr(validator.requests, "get", get)

    response = validator.airflow_get("/api/v2/dags/sample_data/dagRuns", timeout=10)

    assert response is not None
    assert post_timeouts == [10]
    assert get_timeouts == [3]
