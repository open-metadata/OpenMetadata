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

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from requests import Response
from requests.exceptions import HTTPError

from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdateType,
)
from metadata.ingestion.ometa.client import APIError, RestTransportError
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
        metadata.create_or_update_pipeline_status.assert_called_with("svc.pipeline", status)
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

    def test_503_does_not_stack_retries_on_rest_client(self):
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

        metadata.create_or_update_pipeline_status.assert_called_once()
        delay.assert_not_called()

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
