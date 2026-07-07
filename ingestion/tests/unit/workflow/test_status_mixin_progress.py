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
"""send_progress_update maps ProgressReporter.eta_seconds into the SSE payload."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdateType,
)
from metadata.utils.progress_registry import ProgressRegistry
from metadata.workflow.workflow_status_mixin import WorkflowStatusMixin


class _FakeStep:
    def __init__(self, registry: ProgressRegistry) -> None:
        self._progress_registry = registry


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
        with patch("metadata.utils.progress_registry.time.monotonic") as clock:
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
