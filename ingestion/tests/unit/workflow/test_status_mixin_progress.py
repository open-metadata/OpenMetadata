#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""send_progress_update maps ProgressRegistry.eta_seconds into the SSE payload."""

import json
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests
from requests import Response
from requests.exceptions import HTTPError

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdateType,
)
from metadata.ingestion.ometa.client import APIError, ClientConfig, REST, RestTransportError
from metadata.ingestion.ometa.mixins.ingestion_pipeline_mixin import OMetaIngestionPipelineMixin
from metadata.ingestion.progress.registry import ProgressRegistry
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin


class _FakeStep:
    def __init__(self, registry: ProgressRegistry) -> None:
        self._progress_tracking = SimpleNamespace(registry=registry)


class _Harness(WorkflowStatusMixin):
    def __init__(self, registry: ProgressRegistry, metadata: MagicMock) -> None:
        self._run_id = "run-1"
        self.metadata = metadata
        self.config = SimpleNamespace(ingestionPipelineFQN="svc.pipeline")
        self.ingestion_pipeline = SimpleNamespace(fullyQualifiedName=SimpleNamespace(root="svc.pipeline"))
        self._steps = [_FakeStep(registry)]

    def workflow_steps(self):
        return self._steps


def _sent_update(metadata: MagicMock):
    assert metadata.send_progress_update.called
    return metadata.send_progress_update.call_args.args[2]


class TestEstimatedSecondsRemaining:
    def test_maps_eta_seconds_into_payload(self):
        reg = ProgressRegistry()
        metadata = MagicMock()
        with patch("metadata.ingestion.progress.registry.time.monotonic") as clock:
            clock.return_value = 0.0
            reg.open([], "Database", None)
            reg.set_total("DatabaseSchema", 10)
            for _ in range(2):
                reg.track("DatabaseSchema")
            clock.return_value = 60.0
            _Harness(reg, metadata).send_progress_update()
        assert _sent_update(metadata).estimatedSecondsRemaining == 240

    def test_null_when_not_computable(self):
        reg = ProgressRegistry()
        metadata = MagicMock()
        reg.open([], "Database", None)
        reg.set_total("DatabaseSchema", 10)
        _Harness(reg, metadata).send_progress_update()
        assert _sent_update(metadata).estimatedSecondsRemaining is None


class TestTotalAssetsIngested:
    def test_processing_update_carries_leaf_total(self):
        reg = ProgressRegistry()
        metadata = MagicMock()
        reg.open([], "Database", None)
        reg.open(["db", "sch"], "Table", 3)
        reg.open(["db", "sch"], "StoredProcedure", 2)
        for _ in range(3):
            reg.advance(["db", "sch"], "Table")
        for _ in range(2):
            reg.advance(["db", "sch"], "StoredProcedure")
        _Harness(reg, metadata).send_progress_update()
        assert _sent_update(metadata).totalAssetsIngested == 5

    def test_terminal_update_carries_final_total_after_pruning(self):
        reg = ProgressRegistry()
        metadata = MagicMock()
        reg.open([], "Database", None)
        reg.open(["db", "sch"], "Table", 2)
        reg.advance(["db", "sch"], "Table")
        reg.advance(["db", "sch"], "Table")
        reg.close(["db", "sch"])
        reg.close(["db"])
        _Harness(reg, metadata).send_progress_update(ProgressUpdateType.PIPELINE_COMPLETE)
        update = _sent_update(metadata)
        assert update.updateType is ProgressUpdateType.PIPELINE_COMPLETE
        assert update.totalAssetsIngested == 2

    def test_null_when_no_registry(self):
        metadata = MagicMock()
        harness = _Harness(ProgressRegistry(), metadata)
        harness._steps = []
        harness.send_progress_update()
        assert _sent_update(metadata).totalAssetsIngested is None


class TestTerminalStatusWriteRetry:
    def test_retries_transient_transport_failure_for_terminal_status(self):
        metadata = MagicMock()
        metadata.create_or_update_pipeline_status.side_effect = [
            RestTransportError("PUT", "/pipelineStatus", TimeoutError("connection reset")),
            None,
        ]
        harness = _Harness(ProgressRegistry(), metadata)
        status = MagicMock()

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            harness._write_pipeline_status("svc.pipeline", status, terminal=True)

        assert metadata.create_or_update_pipeline_status.call_count == 2
        metadata.create_or_update_pipeline_status.assert_called_with("svc.pipeline", status, retries=0)
        delay.assert_called_once()

    def test_does_not_retry_running_status_or_forge_a_success(self):
        metadata = MagicMock()
        metadata.create_or_update_pipeline_status.side_effect = RestTransportError(
            "PUT", "/pipelineStatus", TimeoutError("connection reset")
        )
        harness = _Harness(ProgressRegistry(), metadata)
        status = MagicMock()

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            with pytest.raises(RestTransportError):
                harness._write_pipeline_status("svc.pipeline", status, terminal=False)

        metadata.create_or_update_pipeline_status.assert_called_once()
        delay.assert_not_called()

    def test_non_retryable_api_error_fails_without_rewriting_status(self):
        metadata = MagicMock()
        metadata.create_or_update_pipeline_status.side_effect = APIError(
            {"message": "Permission denied"}
        )
        harness = _Harness(ProgressRegistry(), metadata)
        status = MagicMock()

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            with pytest.raises(APIError):
                harness._write_pipeline_status("svc.pipeline", status, terminal=True)

        metadata.create_or_update_pipeline_status.assert_called_once()
        delay.assert_not_called()

    def test_terminal_status_retry_is_bounded(self):
        metadata = MagicMock()
        metadata.create_or_update_pipeline_status.side_effect = RestTransportError(
            "PUT", "/pipelineStatus", TimeoutError("connection reset")
        )
        harness = _Harness(ProgressRegistry(), metadata)

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            with pytest.raises(RestTransportError):
                harness._write_pipeline_status("svc.pipeline", MagicMock(), terminal=True)

        assert metadata.create_or_update_pipeline_status.call_count == 3
        assert delay.call_count == 2

    def test_gateway_502_with_plain_http_error_is_retried(self):
        metadata = MagicMock()
        response = Response()
        response.status_code = 502
        metadata.create_or_update_pipeline_status.side_effect = [
            HTTPError("Bad Gateway (HTML response)", response=response),
            None,
        ]
        harness = _Harness(ProgressRegistry(), metadata)

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            harness._write_pipeline_status("svc.pipeline", MagicMock(), terminal=True)

        assert metadata.create_or_update_pipeline_status.call_count == 2
        delay.assert_called_once()

    def test_503_uses_the_same_terminal_retry_budget(self):
        metadata = MagicMock()
        response = Response()
        response.status_code = 503
        metadata.create_or_update_pipeline_status.side_effect = HTTPError(
            "Service Unavailable", response=response
        )
        harness = _Harness(ProgressRegistry(), metadata)

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            with pytest.raises(HTTPError):
                harness._write_pipeline_status("svc.pipeline", MagicMock(), terminal=True)

        assert metadata.create_or_update_pipeline_status.call_count == 3
        assert delay.call_count == 2
        assert all(call.kwargs == {"retries": 0} for call in metadata.create_or_update_pipeline_status.call_args_list)

    def test_terminal_read_retries_transport_failure_before_write(self):
        metadata = MagicMock()
        saved_status = MagicMock()
        metadata.get_pipeline_status.side_effect = [
            RestTransportError("GET", "/pipelineStatus/run-1", TimeoutError("reset")),
            saved_status,
        ]
        harness = _Harness(ProgressRegistry(), metadata)

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            actual = harness._read_pipeline_status("svc.pipeline", "run-1", terminal=True)

        assert actual is saved_status
        assert metadata.get_pipeline_status.call_count == 2
        delay.assert_called_once()

    def test_running_read_does_not_retry(self):
        metadata = MagicMock()
        metadata.get_pipeline_status.side_effect = RestTransportError(
            "GET", "/pipelineStatus/run-1", TimeoutError("reset")
        )
        harness = _Harness(ProgressRegistry(), metadata)

        with patch("metadata.workflow.workflow_status_mixin.sleep") as delay:
            with pytest.raises(RestTransportError):
                harness._read_pipeline_status("svc.pipeline", "run-1", terminal=False)

        metadata.get_pipeline_status.assert_called_once()
        delay.assert_not_called()

    def test_terminal_flow_retries_get_and_put_without_changing_outcome(self):
        metadata = MagicMock()
        saved_status = MagicMock()
        metadata.get_pipeline_status.side_effect = [
            RestTransportError("GET", "/pipelineStatus/run-1", TimeoutError("reset")),
            saved_status,
        ]
        response = Response()
        response.status_code = 502
        metadata.create_or_update_pipeline_status.side_effect = [
            HTTPError("Bad Gateway", response=response),
            None,
        ]
        harness = _Harness(ProgressRegistry(), metadata)
        harness.config = MagicMock()
        harness.config.ingestionPipelineFQN = "svc.pipeline"
        harness.config.model_dump.return_value = {}

        with (
            patch("metadata.workflow.workflow_status_mixin.sleep") as delay,
            patch(
                "metadata.workflow.workflow_status_mixin.ContextManager.dump_contexts",
                return_value={},
            ),
        ):
            harness.set_ingestion_pipeline_status(PipelineState.success)

        assert metadata.get_pipeline_status.call_count == 2
        assert all(
            call.args == ("svc.pipeline", "run-1") and call.kwargs == {"retries": 0}
            for call in metadata.get_pipeline_status.call_args_list
        )
        assert metadata.create_or_update_pipeline_status.call_count == 2
        assert all(
            call.args == ("svc.pipeline", saved_status) and call.kwargs == {"retries": 0}
            for call in metadata.create_or_update_pipeline_status.call_args_list
        )
        assert saved_status.pipelineState is PipelineState.success
        assert saved_status.endDate is not None
        assert delay.call_count == 2

    def test_terminal_retry_persists_success_after_transient_gateway_failure(self):
        """After a transient PUT failure, a refreshed status must be durable success."""
        persisted = {
            "value": SimpleNamespace(
                pipelineState=PipelineState.running,
                endDate=None,
                status=None,
            )
        }
        attempts = {"writes": 0}
        metadata = MagicMock()

        def read_saved_status(fqn, run_id, *, retries=None):
            assert (fqn, run_id) == ("svc.pipeline", "run-1")
            return deepcopy(persisted["value"])

        def save_status(fqn, status, *, retries=None):
            assert fqn == "svc.pipeline"
            attempts["writes"] += 1
            if attempts["writes"] == 1:
                response = Response()
                response.status_code = 502
                raise HTTPError("temporary gateway failure", response=response)
            persisted["value"] = deepcopy(status)

        metadata.get_pipeline_status.side_effect = read_saved_status
        metadata.create_or_update_pipeline_status.side_effect = save_status
        harness = _Harness(ProgressRegistry(), metadata)
        harness.config = MagicMock()
        harness.config.ingestionPipelineFQN = "svc.pipeline"
        harness.config.model_dump.return_value = {}

        assert read_saved_status("svc.pipeline", "run-1").pipelineState is PipelineState.running
        with (
            patch("metadata.workflow.workflow_status_mixin.sleep") as delay,
            patch(
                "metadata.workflow.workflow_status_mixin.ContextManager.dump_contexts",
                return_value={},
            ),
        ):
            harness.set_ingestion_pipeline_status(PipelineState.success)

        refreshed = read_saved_status("svc.pipeline", "run-1")
        assert refreshed.pipelineState is PipelineState.success
        assert refreshed.endDate is not None
        assert attempts["writes"] == 2
        delay.assert_called_once()


class TestHttpTerminalPersistence:
    def test_real_http_gateway_recovers_terminal_status(self):
        """Exercise a real HTTP 502 response and durable reread over loopback."""
        state = {"status": "running", "finished": False, "puts": 0}

        class StatusEndpoint(BaseHTTPRequestHandler):
            def do_GET(self):
                payload = json.dumps(
                    {"state": state["status"], "finished": state["finished"]}
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_PUT(self):
                state["puts"] += 1
                length = int(self.headers["Content-Length"])
                payload = json.loads(
                    self.rfile.read(length).decode("utf-8")
                )
                if state["puts"] == 1:
                    self.send_response(502)
                    self.send_header("Content-Type", "text/html")
                    self.end_headers()
                    self.wfile.write(b"<html>temporary gateway failure</html>")
                    return
                state["status"] = payload["state"]
                state["finished"] = payload["finished"]
                self.send_response(204)
                self.end_headers()

            def log_message(self, format, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), StatusEndpoint)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/status/run-1"

        class HttpMetadata:
            def get_pipeline_status(self, fqn, run_id, *, retries=None):
                assert (fqn, run_id) == ("svc.pipeline", "run-1")
                response = requests.get(url, timeout=5)
                response.raise_for_status()
                info = response.json()
                return SimpleNamespace(
                    pipelineState=PipelineState(info["state"]),
                    endDate=info["finished"],
                    status=None,
                )

            def create_or_update_pipeline_status(self, fqn, status, *, retries=None):
                assert fqn == "svc.pipeline"
                response = requests.put(
                    url,
                    json={
                        "state": status.pipelineState.value,
                        "finished": status.endDate is not None,
                    },
                    timeout=5,
                )
                response.raise_for_status()

        try:
            harness = _Harness(ProgressRegistry(), HttpMetadata())
            harness.config = MagicMock()
            harness.config.ingestionPipelineFQN = "svc.pipeline"
            harness.config.model_dump.return_value = {}
            with (
                patch("metadata.workflow.workflow_status_mixin.sleep") as delay,
                patch(
                    "metadata.workflow.workflow_status_mixin.ContextManager.dump_contexts",
                    return_value={},
                ),
            ):
                harness.set_ingestion_pipeline_status(PipelineState.success)

            saved = requests.get(url, timeout=5).json()
            assert saved == {"state": PipelineState.success.value, "finished": True}
            assert state["puts"] == 2
            delay.assert_called_once()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


class TestTerminalStatusRetryBudget:
    @pytest.mark.parametrize("method", ["GET", "PUT"])
    @pytest.mark.parametrize("sequence", ["mixed_exhausted", "mixed_recovered", "review_sequence"])
    def test_mixed_gateway_and_transport_failures_share_budget(self, method, sequence):
        """Exercise the actual REST retry loop and pipeline API, not a mocked API."""

        class PipelineMetadata(OMetaIngestionPipelineMixin):
            def get_suffix(self, entity):
                return "/services/ingestionPipelines"

        def response(code):
            result = Response()
            result.status_code = code
            result._content = b""
            result.url = "http://localhost/api/v1/pipelineStatus"
            return result

        metadata = PipelineMetadata()
        status = MagicMock()
        status.model_dump_json.return_value = "{}"
        with REST(ClientConfig(base_url="http://localhost/api", retry=3, retry_wait=30)) as client:
            metadata.client = client
            harness = _Harness(ProgressRegistry(), metadata)
            # The old implementation consumes three 503s, a timeout, and
            # starts another REST retry loop. The new one stops after three
            # total client calls, even if the error category changes.
            if sequence == "review_sequence":
                failures = [
                    response(503),
                    response(503),
                    response(503),
                    requests.exceptions.Timeout("read timed out"),
                ] * 3
            else:
                failures = [
                    response(503),
                    requests.exceptions.Timeout("read timed out"),
                    response(204 if sequence == "mixed_recovered" else 503),
                ]
            with (
                patch.object(client._session, "request", side_effect=failures) as request,
                patch("metadata.ingestion.ometa.client.time.sleep") as rest_delay,
                patch("metadata.workflow.workflow_status_mixin.sleep") as outer_delay,
            ):
                def operation():
                    if method == "GET":
                        return harness._read_pipeline_status("svc.pipeline", "run-1", terminal=True)
                    return harness._write_pipeline_status("svc.pipeline", status, terminal=True)

                if sequence == "mixed_recovered":
                    operation()
                else:
                    with pytest.raises(HTTPError):
                        operation()

                assert request.call_count == 3
                rest_delay.assert_not_called()
                assert [call.args for call in outer_delay.call_args_list] == [(0.25,), (0.5,)]
