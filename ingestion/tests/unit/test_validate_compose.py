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
    """Minimal successful response returned by the Airflow HTTP boundary."""

    status_code = 200

    def json(self) -> dict[str, list[dict[str, str]]]:
        return {
            "dag_runs": [
                {
                    "dag_run_id": "run-1",
                    "logical_date": "2026-08-24T00:00:00Z",
                    "state": "running",
                }
            ]
        }


def load_validate_compose() -> ModuleType:
    """Load the Docker-executed validator without running its CLI entry point."""
    spec = importlib.util.spec_from_file_location("validate_compose_test_module", VALIDATE_COMPOSE_PATH)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_timeout_keeps_last_observed_run_after_transient_poll_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Timeout diagnostics retain the last run when the final Airflow poll fails."""
    validator = load_validate_compose()
    clock = FakeClock()
    airflow_responses = iter([FakeAirflowResponse(), None])
    diagnostic_run_ids: list[str | None] = []

    monkeypatch.setattr(validator, "time", clock)
    monkeypatch.setattr(validator, "get_env_int", lambda _name, _default: 1)
    monkeypatch.setattr(validator, "resolve_timeout_seconds", lambda _interval: 1)
    monkeypatch.setattr(validator, "airflow_get", lambda _path, _timeout: next(airflow_responses))
    monkeypatch.setattr(validator, "dump_diagnostics", diagnostic_run_ids.append)
    monkeypatch.setattr(validator, "log", lambda _message: None)

    with pytest.raises(SystemExit) as exit_info:
        validator.main()

    assert diagnostic_run_ids == ["run-1"]
    assert "last observed run=run-1, state=running" in str(exit_info.value)
