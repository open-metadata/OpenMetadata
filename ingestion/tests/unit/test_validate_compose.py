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
import subprocess
from pathlib import Path
from types import ModuleType
from urllib.parse import parse_qs, urlparse

import pytest
import requests

VALIDATE_COMPOSE_PATH = Path(__file__).resolve().parents[3] / "docker" / "validate_compose.py"
RUN_LOCAL_DOCKER_COMMON_PATH = Path(__file__).resolve().parents[3] / "docker" / "run_local_docker_common.sh"


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

    def __init__(
        self,
        payload: object,
        text: str = "",
        status_code: int = 200,
        json_error: ValueError | None = None,
    ) -> None:
        self.payload = payload
        self.text = text
        self.status_code = status_code
        self.json_error = json_error

    def json(self) -> object:
        if self.json_error:
            raise self.json_error
        return self.payload


class FakeTokenResponse:
    """Minimal token response returned by the Airflow authentication boundary."""

    status_code = 201

    def json(self) -> dict[str, str]:
        return {"access_token": "token"}


class FakeHttpSession:
    """Scriptable HTTP boundary for the container-side Airflow client."""

    def __init__(
        self,
        post_responses: list[FakeAirflowResponse | FakeTokenResponse],
        get_responses: list[FakeAirflowResponse | requests.exceptions.RequestException],
    ) -> None:
        self.post_responses = post_responses
        self.get_responses = get_responses
        self.post_calls: list[dict[str, object]] = []
        self.get_calls: list[dict[str, object]] = []

    def post(self, url: str, **kwargs: object) -> FakeAirflowResponse | FakeTokenResponse:
        self.post_calls.append({"url": url, **kwargs})
        return self.post_responses.pop(0)

    def get(self, url: str, **kwargs: object) -> FakeAirflowResponse:
        self.get_calls.append({"url": url, **kwargs})
        response = self.get_responses.pop(0)
        if isinstance(response, requests.exceptions.RequestException):
            raise response
        return response


def load_validate_compose() -> ModuleType:
    """Load the Docker-executed validator without running its CLI entry point."""
    spec = importlib.util.spec_from_file_location("validate_compose_test_module", VALIDATE_COMPOSE_PATH)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare_sample_data_validation_env(
    trigger_succeeded: str,
    logical_date: str,
    dag_run_id: str,
    max_retries: str,
) -> tuple[int, list[str]]:
    """Run the shell's validation environment builder and return its outcome."""
    command = """
source "$1"
prepare_sample_data_validation_env "$2" "$3" "$4" "$5" "$6" "$7"
status=$?
printf '%s\\n' "${validate_compose_env[@]}"
exit "$status"
"""
    result = subprocess.run(
        [
            "bash",
            "-c",
            command,
            "bash",
            str(RUN_LOCAL_DOCKER_COMMON_PATH),
            trigger_succeeded,
            "240",
            "10",
            logical_date,
            dag_run_id,
            max_retries,
        ],
        capture_output=True,
        check=False,
        text=True,
    )
    return result.returncode, result.stdout.splitlines()


def test_failed_trigger_does_not_prepare_a_validation_target() -> None:
    """A failed POST cannot safely be validated as an unrelated scheduled DAG run."""
    exit_code, environment = prepare_sample_data_validation_env(
        "false",
        "2026-08-24T00:00:00Z",
        "",
        "",
    )

    assert exit_code == 1
    assert environment == [
        "-e",
        "VALIDATE_COMPOSE_TIMEOUT_SECONDS=240",
        "-e",
        "VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS=10",
    ]


def test_successful_trigger_preserves_its_validation_target() -> None:
    """A successful trigger keeps both its logical date and explicit run identity."""
    exit_code, environment = prepare_sample_data_validation_env(
        "true",
        "2026-08-24T00:00:00Z",
        "manual__target",
        "7",
    )

    assert exit_code == 0
    assert environment == [
        "-e",
        "VALIDATE_COMPOSE_TIMEOUT_SECONDS=240",
        "-e",
        "VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS=10",
        "-e",
        "VALIDATE_COMPOSE_LOGICAL_DATE=2026-08-24T00:00:00Z",
        "-e",
        "VALIDATE_COMPOSE_DAG_RUN_ID=manual__target",
        "-e",
        "VALIDATE_COMPOSE_MAX_RETRIES=7",
    ]


def test_successful_trigger_without_run_id_targets_its_logical_date() -> None:
    """A successful POST can safely use its submitted logical date as a fallback target."""
    exit_code, environment = prepare_sample_data_validation_env(
        "true",
        "2026-08-24T00:00:00Z",
        "",
        "",
    )

    assert exit_code == 0
    assert environment == [
        "-e",
        "VALIDATE_COMPOSE_TIMEOUT_SECONDS=240",
        "-e",
        "VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS=10",
        "-e",
        "VALIDATE_COMPOSE_LOGICAL_DATE=2026-08-24T00:00:00Z",
    ]


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

    assert validator.get_last_run_info(None, "2026-08-24T00:00:00Z", 1) == (
        "manual__target",
        "queued",
        True,
    )
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
            FakeAirflowResponse({"dag_run_id": "run-1", "state": "running"}),
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


def test_timeout_diagnoses_known_triggered_run_after_poll_failures(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """A known target still gets run and task diagnostics after transient poll failures."""
    validator = load_validate_compose()
    clock = FakeClock()
    session = FakeHttpSession(
        post_responses=[FakeTokenResponse()],
        get_responses=[
            requests.exceptions.ConnectionError("first poll failed"),
            requests.exceptions.ConnectionError("second poll failed"),
            FakeAirflowResponse({"dag_run_id": "manual__target", "state": "running"}),
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
        ],
    )

    monkeypatch.setattr(validator, "time", clock)
    monkeypatch.setattr(validator, "get_http_session", lambda: session)
    monkeypatch.setenv("VALIDATE_COMPOSE_DAG_RUN_ID", "manual__target")
    monkeypatch.setenv("VALIDATE_COMPOSE_RETRY_INTERVAL_SECONDS", "1")
    monkeypatch.setenv("VALIDATE_COMPOSE_TIMEOUT_SECONDS", "1")
    monkeypatch.delenv("VALIDATE_COMPOSE_MAX_RETRIES", raising=False)

    with pytest.raises(SystemExit) as exit_info:
        validator.main()

    output = capsys.readouterr().out
    assert "Diagnostic DAG run [manual__target] is running." in output
    assert "Task instances for manual__target:" in output
    assert "last observed run=manual__target, state=running" in str(exit_info.value)


def test_airflow_get_reauthenticates_once_within_the_caller_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A rejected cached token is refreshed before diagnostic requests give up."""
    validator = load_validate_compose()
    session = FakeHttpSession(
        post_responses=[FakeTokenResponse()],
        get_responses=[
            FakeAirflowResponse({}, status_code=401),
            FakeAirflowResponse({"dag_run_id": "manual__target", "state": "running"}),
        ],
    )
    validator._access_token = "stale-token"

    monkeypatch.setattr(validator, "get_http_session", lambda: session)

    response = validator.airflow_get("/api/v2/dags/sample_data/dagRuns/manual__target", 10)

    assert response is not None
    assert response.status_code == 200
    assert [call["headers"]["Authorization"] for call in session.get_calls] == [
        "Bearer stale-token",
        "Bearer token",
    ]
    assert len(session.post_calls) == 1
    assert session.post_calls[0]["timeout"] <= 10


def test_get_last_run_info_treats_malformed_airflow_responses_as_transient(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Bad JSON and malformed DAG-run lists keep validation alive for diagnostics."""
    validator = load_validate_compose()
    session = FakeHttpSession(
        post_responses=[FakeTokenResponse()],
        get_responses=[
            FakeAirflowResponse(None, json_error=ValueError("invalid JSON")),
            FakeAirflowResponse({"dag_runs": {"not": "a list"}}),
        ],
    )

    monkeypatch.setattr(validator, "get_http_session", lambda: session)

    assert validator.get_last_run_info("manual__target", None, 10) == (None, None, False)
    assert validator.get_last_run_info(None, "2026-08-24T00:00:00Z", 10) == (
        None,
        None,
        False,
    )
    output = capsys.readouterr().out
    assert "Airflow returned invalid JSON for DAG-run." in output
    assert "Airflow DAG-runs response did not contain a list of dag_runs." in output


def test_task_diagnostics_encode_run_ids_and_paginate(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Timeout diagnostics report every task from the correctly encoded target route."""
    validator = load_validate_compose()
    session = FakeHttpSession(
        post_responses=[FakeTokenResponse()],
        get_responses=[
            FakeAirflowResponse(
                {
                    "task_instances": [{"task_id": "first-task", "state": "running"}],
                    "total_entries": 2,
                }
            ),
            FakeAirflowResponse(
                {
                    "task_instances": [{"task_id": "second-task", "state": "queued"}],
                    "total_entries": 2,
                }
            ),
        ],
    )

    monkeypatch.setattr(validator, "get_http_session", lambda: session)

    validator.print_task_instance_states("manual/a?b", 8)

    output = capsys.readouterr().out
    assert "Task instances for manual/a?b:" in output
    assert "first-task: state=running" in output
    assert "second-task: state=queued" in output
    assert [urlparse(call["url"]).path for call in session.get_calls] == [
        "/api/v2/dags/sample_data/dagRuns/manual%2Fa%3Fb/taskInstances",
        "/api/v2/dags/sample_data/dagRuns/manual%2Fa%3Fb/taskInstances",
    ]
    assert [parse_qs(urlparse(call["url"]).query) for call in session.get_calls] == [
        {"limit": ["100"], "offset": ["0"]},
        {"limit": ["100"], "offset": ["1"]},
    ]


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

    session = FakeHttpSession([], [])
    monkeypatch.setattr(validator, "time", clock)
    monkeypatch.setattr(session, "post", post)
    monkeypatch.setattr(session, "get", get)
    monkeypatch.setattr(validator, "get_http_session", lambda: session)

    response = validator.airflow_get("/api/v2/dags/sample_data/dagRuns", timeout=10)

    assert response is not None
    assert post_timeouts == [10]
    assert get_timeouts == [3]
