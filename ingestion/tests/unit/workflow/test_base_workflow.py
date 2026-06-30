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
"""
Validate the logic and status handling of the base workflow
"""

from typing import Iterable, Tuple  # noqa: UP035
from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    PipelineState,
)
from metadata.generated.schema.entity.services.ingestionPipelines.progressUpdate import (
    ProgressUpdateType,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.step import Step  # noqa: TC001
from metadata.ingestion.api.steps import Sink
from metadata.ingestion.api.steps import Source as WorkflowSource
from metadata.workflow.ingestion import IngestionWorkflow


class SimpleSource(WorkflowSource):
    """
    Simple Source for testing
    """

    def prepare(self):
        """Nothing to do"""

    def test_connection(self) -> None:
        """Nothing to do"""

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "SimpleSource":
        return cls()

    def close(self) -> None:
        """Nothing to do"""

    def _iter(self, *args, **kwargs) -> Iterable[Either]:
        for element in range(0, 5):  # noqa: PIE808
            yield Either(right=element)


class BrokenSource(WorkflowSource):
    """Source not returning an Either"""

    def prepare(self):
        """Nothing to do"""

    def test_connection(self) -> None:
        """Nothing to do"""

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "SimpleSource":
        return cls()

    def close(self) -> None:
        """Nothing to do"""

    def _iter(self, *args, **kwargs) -> Iterable[int]:
        for element in range(0, 5):  # noqa: PIE808
            yield int(element)


class SimpleSink(Sink):
    """
    Simple Sink for testing
    """

    def _run(self, element: int) -> Either:
        if element == 2:
            return Either(left=StackTraceError(name="bum", error="kaboom", stackTrace="trace"))

        return Either(right=element)

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "SimpleSink":
        return cls()

    def close(self) -> None:
        """Nothing to do"""


class SimpleWorkflow(IngestionWorkflow):
    """
    Simple Workflow for testing
    """

    def set_steps(self):
        self.source = SimpleSource()

        self.steps: Tuple[Step] = (SimpleSink(),)  # noqa: UP006


class BrokenWorkflow(IngestionWorkflow):
    """
    Simple Workflow for testing
    """

    def set_steps(self):
        self.source = BrokenSource()

        self.steps: Tuple[Step] = (SimpleSink(),)  # noqa: UP006


# Pass only the required details so that the workflow can be initialized
config = OpenMetadataWorkflowConfig(
    source=Source(
        type="simple",
        serviceName="test",
        sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
    ),
    workflowConfig=WorkflowConfig(
        openMetadataServerConfig=OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            ),
        )
    ),
)


class TestBaseWorkflow(TestCase):
    """
    Parent workflow class
    """

    workflow = SimpleWorkflow(config=config)
    broken_workflow = BrokenWorkflow(config=config)

    @pytest.mark.order(1)
    def test_workflow_executes(self):
        self.workflow.execute()

        # We have scanned some information properly
        self.assertTrue(len(self.workflow.source.status.records))

    @pytest.mark.order(2)
    def test_workflow_status(self):
        # Everything is processed properly in the Source
        self.assertEqual(self.workflow.source.status.records, ["0", "1", "2", "3", "4"])
        self.assertEqual(len(self.workflow.source.status.failures), 0)

        # We catch one error in the Sink
        self.assertEqual(len(self.workflow.steps[0].status.records), 4)
        self.assertEqual(len(self.workflow.steps[0].status.failures), 1)

    @pytest.mark.order(3)
    def test_workflow_raise_status(self):
        # We catch the error on the Sink
        self.assertRaises(WorkflowExecutionError, self.workflow.raise_from_status)

    def test_broken_workflow(self):
        """test our broken workflow return expected exc"""
        self.broken_workflow.execute()
        self.assertRaises(WorkflowExecutionError, self.broken_workflow.raise_from_status)
        self.assertEqual(self.broken_workflow.source.status.failures[0].name, "Not an Either")
        assert "workflow/test_base_workflow.py" in self.broken_workflow.source.status.failures[0].error

    def test_workflow_config_supports_ingestion_runner_name(self):
        workflow_config = OpenMetadataWorkflowConfig(
            source=config.source,
            workflowConfig=config.workflowConfig,
            ingestionRunnerName="test-runner",
        )

        self.assertEqual(workflow_config.ingestionRunnerName, "test-runner")


class TestWorkflowExecuteTeardown:
    """
    Validates the execute() teardown contract:
      1. close_steps() flushes step buffers before any consumer reads from the
         step statuses. Both the persisted pipeline status (built from
         Summary.from_step) and the printed summary share those same step
         status objects, so the flush must happen before either reads them.
      2. print_status() runs before stop() so the streamable logging handler
         (torn down inside stop()) is still alive when the final summary is
         emitted.
      3. stop() must still run when an inner step raises so we never leak the
         timer thread, OM client, or any step resources.
    """

    def test_close_steps_runs_before_status_publishing_and_stop(self):
        workflow = SimpleWorkflow(config=config)
        manager = MagicMock()

        with (
            patch.object(workflow, "close_steps", wraps=workflow.close_steps) as mock_close_steps,
            patch.object(
                workflow,
                "build_ingestion_status",
                wraps=workflow.build_ingestion_status,
            ) as mock_build_ingestion_status,
            patch.object(
                workflow,
                "set_ingestion_pipeline_status",
                wraps=workflow.set_ingestion_pipeline_status,
            ) as mock_set_ingestion_pipeline_status,
            patch.object(workflow, "print_status", wraps=workflow.print_status) as mock_print_status,
            patch.object(
                workflow,
                "send_progress_update",
                wraps=workflow.send_progress_update,
            ) as mock_send_progress_update,
            patch.object(workflow, "stop", wraps=workflow.stop) as mock_stop,
        ):
            manager.attach_mock(mock_close_steps, "close_steps")
            manager.attach_mock(mock_build_ingestion_status, "build_ingestion_status")
            manager.attach_mock(mock_set_ingestion_pipeline_status, "set_ingestion_pipeline_status")
            manager.attach_mock(mock_send_progress_update, "send_progress_update")
            manager.attach_mock(mock_print_status, "print_status")
            manager.attach_mock(mock_stop, "stop")

            workflow.execute()

        ordered_names = [mock_call[0] for mock_call in manager.mock_calls]
        # `close_steps` is recorded twice: once from execute() before
        # print_status, and once from inside stop() to keep the public
        # cleanup contract. The second call is a no-op via _steps_closed.
        assert ordered_names == [
            "close_steps",
            "build_ingestion_status",
            "set_ingestion_pipeline_status",
            "send_progress_update",
            "print_status",
            "stop",
            "close_steps",
        ]
        mock_send_progress_update.assert_called_once_with(ProgressUpdateType.ERROR)

    def test_success_states_map_to_pipeline_complete_progress(self):
        workflow = SimpleWorkflow(config=config)

        assert (
            workflow.terminal_progress_update_type(PipelineState.success)
            is ProgressUpdateType.PIPELINE_COMPLETE
        )
        assert (
            workflow.terminal_progress_update_type(PipelineState.partialSuccess)
            is ProgressUpdateType.PIPELINE_COMPLETE
        )

    def test_failed_workflow_sends_terminal_error_progress(self):
        workflow = BrokenWorkflow(config=config)

        with patch.object(
            workflow,
            "send_progress_update",
            wraps=workflow.send_progress_update,
        ) as mock_send_progress_update:
            workflow.execute()

        mock_send_progress_update.assert_called_once_with(ProgressUpdateType.ERROR)

    def test_stop_still_runs_when_print_status_raises(self):
        workflow = SimpleWorkflow(config=config)

        with (
            patch.object(
                workflow,
                "print_status",
                side_effect=RuntimeError("boom"),
            ) as mock_print_status,
            patch.object(workflow, "stop", wraps=workflow.stop) as mock_stop,
        ):
            with pytest.raises(RuntimeError, match="boom"):
                workflow.execute()

            mock_print_status.assert_called_once()
            mock_stop.assert_called_once()

    def test_pipeline_status_is_persisted_when_close_steps_raises(self):
        """
        Even on a catastrophic close_steps() failure, the pipeline status must
        still be persisted to the server and stop() must still run. This
        preserves the pre-existing "status is always sent" invariant; the
        flushed counts may be missing in this edge case but a status record is
        better than none.
        """
        workflow = SimpleWorkflow(config=config)

        with (
            patch.object(
                workflow,
                "close_steps",
                side_effect=RuntimeError("flush-boom"),
            ) as mock_close_steps,
            patch.object(
                workflow,
                "set_ingestion_pipeline_status",
                wraps=workflow.set_ingestion_pipeline_status,
            ) as mock_set_ingestion_pipeline_status,
            patch.object(workflow, "print_status", wraps=workflow.print_status) as mock_print_status,
            patch.object(workflow, "stop", wraps=workflow.stop) as mock_stop,
        ):
            workflow.execute()

            # close_steps is invoked twice: once from execute() before
            # print_status and once from inside stop() (the public-cleanup
            # contract). The invariant we care about here is that the
            # pipeline status is still persisted, print_status still runs,
            # and stop() still runs.
            assert mock_close_steps.call_count == 2
            mock_set_ingestion_pipeline_status.assert_called_once()
            mock_print_status.assert_called_once()
            mock_stop.assert_called_once()

    def test_stop_closes_steps_when_called_standalone(self):
        """
        stop() is part of the public cleanup contract — callers that invoke
        it without going through execute() (or in addition to execute()) must
        still get step buffers flushed and step resources released. Substitute
        a mock timer (the real one would raise on join() of an unstarted
        thread) and stub the OM client teardown so we exercise just the
        cleanup contract.
        """
        workflow = SimpleWorkflow(config=config)
        workflow._timer = MagicMock()
        step = workflow.steps[0]

        with (
            patch.object(workflow.metadata, "close"),
            patch.object(step, "close", wraps=step.close) as mock_step_close,
        ):
            workflow.stop()

            mock_step_close.assert_called_once()

    def test_close_steps_is_idempotent_across_execute_and_stop(self):
        """
        execute() flushes via close_steps() before print_status, and stop()
        also calls close_steps() to keep the public cleanup contract. The
        _steps_closed flag must prevent the second call from re-running
        step.close() (some sinks are not idempotent across repeat closes).
        """
        workflow = SimpleWorkflow(config=config)
        step = workflow.steps[0]

        with patch.object(step, "close", wraps=step.close) as mock_step_close:
            workflow.execute()

            mock_step_close.assert_called_once()
