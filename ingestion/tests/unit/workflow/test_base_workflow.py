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
"""Validate the logic and status handling of the base workflow."""

import json
import uuid
from collections.abc import Iterable
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest

from metadata.cli.common import execute_workflow
from metadata.cmd import metadata as metadata_cli
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
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline,
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


class OkSink(Sink):
    """Sink that never produces failures — every element succeeds."""

    def _run(self, element: int) -> Either:
        return Either(right=element)

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "OkSink":
        return cls()

    def close(self) -> None:
        """Nothing to do"""


class SimpleWorkflow(IngestionWorkflow):
    """
    Simple Workflow for testing
    """

    def set_steps(self):
        self.source = SimpleSource()

        self.steps: tuple[Step] = (SimpleSink(),)


class OkWorkflow(IngestionWorkflow):
    """Workflow wired to OkSink — produces zero failures."""

    def set_steps(self):
        self.source = SimpleSource()
        self.steps: tuple[Step] = (OkSink(),)


class BrokenWorkflow(IngestionWorkflow):
    """
    Simple Workflow for testing
    """

    def set_steps(self):
        self.source = BrokenSource()

        self.steps: tuple[Step] = (SimpleSink(),)


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


def _self_registration_workflow(source_config: SourceConfig) -> SimpleWorkflow:
    workflow_config = config.model_copy(
        update={"source": config.source.model_copy(update={"type": "mysql", "sourceConfig": source_config})},
        deep=True,
    )

    metadata = MagicMock()
    metadata.config.forceEntityOverwriting = True
    with patch("metadata.workflow.base.create_ometa_client", return_value=metadata):
        workflow = SimpleWorkflow(config=workflow_config)

    workflow.config = workflow_config.model_copy(
        update={"ingestionPipelineFQN": "test-service.self-registered-pipeline"}
    )
    workflow.metadata.get_by_name.return_value = None
    return workflow


def _self_registration_request(source_config):
    workflow = _self_registration_workflow(SourceConfig(config=source_config))
    with patch.object(
        workflow,
        "_get_ingestion_pipeline_service",
        return_value=SimpleNamespace(id=uuid.uuid4()),
    ):
        workflow.get_or_create_ingestion_pipeline()

    return workflow.metadata.create_or_update.call_args.args[0]


def test_self_registration_serializes_default_source_config_type():
    source_config = DatabaseServiceMetadataPipeline()

    assert "type" not in source_config.model_dump(exclude_unset=True)

    request = _self_registration_request(source_config)
    payload = json.loads(request.model_dump_json(context={"mask_secrets": False}, by_alias=True, exclude_unset=True))

    assert payload["sourceConfig"]["config"]["type"] == "DatabaseMetadata"
    assert "type" not in source_config.model_dump(exclude_unset=True)


def test_self_registration_marks_default_type_on_a_copy():
    source_config = SourceConfig(config=DatabaseServiceMetadataPipeline())
    workflow = _self_registration_workflow(source_config)

    copied_source_config = workflow._source_config_with_explicit_type()

    assert copied_source_config is not source_config
    assert copied_source_config.config is not source_config.config
    assert "type" in copied_source_config.config.model_fields_set
    assert "type" not in source_config.config.model_fields_set


def test_self_registration_preserves_raw_source_config_without_copying_or_mutating_it():
    raw_config = {"type": "DatabaseMetadata", "markDeletedTables": True}
    source_config = SourceConfig.model_construct(config=raw_config)
    workflow = _self_registration_workflow(source_config)

    explicit_source_config = workflow._source_config_with_explicit_type()

    assert explicit_source_config is source_config
    assert explicit_source_config.config is raw_config


def test_self_registration_does_not_invent_a_missing_model_type():
    source_config = SourceConfig.model_construct(config=DatabaseServiceMetadataPipeline(type=None))
    workflow = _self_registration_workflow(source_config)

    explicit_source_config = workflow._source_config_with_explicit_type()

    assert explicit_source_config is source_config
    assert explicit_source_config.config.type is None


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
        # An initial `send_progress_update` fires at the very start so short
        # runs (shorter than the reporting interval) still emit a "run started"
        # event. `close_steps` is recorded twice: once from execute() before
        # print_status, and once from inside stop() to keep the public cleanup
        # contract. The second call is a no-op via _steps_closed.
        assert ordered_names == [
            "send_progress_update",
            "close_steps",
            "build_ingestion_status",
            "set_ingestion_pipeline_status",
            "send_progress_update",
            "print_status",
            "stop",
            "close_steps",
        ]
        progress_types = [call.args[0] for call in mock_send_progress_update.call_args_list]
        assert progress_types == [ProgressUpdateType.DISCOVERY, ProgressUpdateType.ERROR]

    def test_success_states_map_to_pipeline_complete_progress(self):
        workflow = SimpleWorkflow(config=config)

        assert workflow.terminal_progress_update_type(PipelineState.success) is ProgressUpdateType.PIPELINE_COMPLETE
        assert (
            workflow.terminal_progress_update_type(PipelineState.partialSuccess) is ProgressUpdateType.PIPELINE_COMPLETE
        )

    def test_failed_workflow_sends_terminal_error_progress(self):
        workflow = BrokenWorkflow(config=config)

        with patch.object(
            workflow,
            "send_progress_update",
            wraps=workflow.send_progress_update,
        ) as mock_send_progress_update:
            workflow.execute()

        progress_types = [call.args[0] for call in mock_send_progress_update.call_args_list]
        assert progress_types == [ProgressUpdateType.DISCOVERY, ProgressUpdateType.ERROR]

    def test_execute_emits_initial_progress_before_work(self):
        """A run shorter than the reporting interval still emits events: an
        initial DISCOVERY at start (so the run is registered/visible live) and
        a terminal update at the end — never zero events."""
        workflow = SimpleWorkflow(config=config)

        emitted = []
        original = workflow.send_progress_update

        def record(update_type=ProgressUpdateType.PROCESSING):
            emitted.append((update_type, workflow.execute_internal_started))
            return original(update_type)

        workflow.execute_internal_started = False
        real_execute_internal = workflow.execute_internal

        def flag_execute_internal():
            workflow.execute_internal_started = True
            return real_execute_internal()

        with (
            patch.object(workflow, "send_progress_update", side_effect=record),
            patch.object(workflow, "execute_internal", side_effect=flag_execute_internal),
        ):
            workflow.execute()

        # First emit is DISCOVERY and happens before execute_internal runs.
        assert emitted[0][0] is ProgressUpdateType.DISCOVERY
        assert emitted[0][1] is False
        # At least the initial + a terminal event, so never zero.
        assert len(emitted) >= 2

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


@pytest.mark.parametrize(
    "source_type,pipeline,expected_source_type",
    [
        ("mysql", DatabaseServiceMetadataPipeline(), "mysql"),
        ("mysql", DatabaseServiceProfilerPipeline(), "mysql"),
        ("mysql-lineage", DatabaseServiceQueryLineagePipeline(), "mysql-lineage"),
    ],
    ids=["metadata", "profiler", "lineage"],
)
def test_write_status_file_reports_source_type_not_pipeline_type(tmp_path, source_type, pipeline, expected_source_type):
    source = Source(
        type=source_type,
        serviceName="test",
        serviceConnection={"config": {"type": "Mysql", "username": "user", "hostPort": "localhost:3306"}},
        sourceConfig=SourceConfig(config=pipeline),
    )
    workflow = OkWorkflow(config=config.model_copy(update={"source": source}))
    workflow.execute()

    status_file = tmp_path / "status.json"
    workflow.write_status_file(status_file)

    assert status_file.exists()
    payload = json.loads(status_file.read_text())

    assert payload["source_type"] == expected_source_type
    assert "pipeline_type" not in payload
    assert payload["ingestion_pipeline_fqn"] is None
    assert payload["success"] is True
    assert isinstance(payload["steps"], list)
    assert len(payload["steps"]) >= 2


def test_write_status_file_reports_failure_shape_with_sink_errors(tmp_path):
    workflow = SimpleWorkflow(config=config)
    workflow.execute()

    status_file = tmp_path / "status.json"
    workflow.write_status_file(status_file)

    payload = json.loads(status_file.read_text())

    assert isinstance(payload["steps"], list)
    assert len(payload["steps"]) >= 2
    sink_steps_with_failures = [s for s in payload["steps"] if s.get("failures")]
    assert len(sink_steps_with_failures) >= 1
    assert payload["success"] is False


def test_write_status_file_reports_failure_when_source_fails(tmp_path):
    workflow = BrokenWorkflow(config=config)
    workflow.execute()

    status_file = tmp_path / "status.json"
    workflow.write_status_file(status_file)

    payload = json.loads(status_file.read_text())
    assert payload["success"] is False


def test_write_status_file_includes_ingestion_pipeline_fqn(tmp_path):
    fqn_config = config.model_copy(update={"ingestionPipelineFQN": "test_service.test_pipeline"})
    workflow = SimpleWorkflow(config=fqn_config)
    workflow.execute()

    status_file = tmp_path / "status.json"
    workflow.write_status_file(status_file)

    payload = json.loads(status_file.read_text())

    assert payload["ingestion_pipeline_fqn"] == "test_service.test_pipeline"


@pytest.mark.parametrize("raise_on_error", [True, False])
def test_execute_workflow_fails_when_status_file_cannot_be_written(tmp_path, raise_on_error):
    workflow = OkWorkflow(config=config)

    with pytest.raises(IsADirectoryError) as error:
        execute_workflow(
            workflow,
            {"workflowConfig": {"raiseOnError": raise_on_error}},
            status_file=tmp_path,
        )

    assert error.value.filename == str(tmp_path)


def test_execute_workflow_preserves_execution_error_when_status_write_also_fails(tmp_path):
    class FailingWorkflow(OkWorkflow):
        def execute_internal(self):
            raise RuntimeError("source execution failed")

    workflow = FailingWorkflow(config=config)

    with pytest.raises(IsADirectoryError) as error:
        execute_workflow(workflow, {}, status_file=tmp_path)

    assert isinstance(error.value.__context__, RuntimeError)
    assert str(error.value.__context__) == "source execution failed"


@pytest.mark.parametrize("workflow_class,success", [(OkWorkflow, True), (SimpleWorkflow, False)])
@pytest.mark.parametrize("status_writable", [True, False])
def test_ingest_dbt_cli_status_file_contract(tmp_path, workflow_class, success, status_writable):
    project = tmp_path / "my_dbt_project"
    target = project / "target"
    target.mkdir(parents=True)
    (target / "manifest.json").write_text("{}")
    (project / "dbt_project.yml").write_text(
        "name: my_project\nvars:\n"
        "  openmetadata_host_port: http://localhost:8585/api\n"
        "  openmetadata_jwt_token: placeholder\n"
        "  openmetadata_service_name: my_service\n"
    )
    status_path = tmp_path / "status.json" if status_writable else tmp_path
    workflow = workflow_class(config=config)

    with patch("metadata.cli.ingest_dbt.MetadataWorkflow.create", return_value=workflow):
        args = ["ingest-dbt", "-c", str(project), "--status-file", str(status_path)]
        if success and status_writable:
            metadata_cli(args)
        else:
            with pytest.raises(SystemExit) as error:
                metadata_cli(args)
            assert error.value.code == 1

    if status_writable:
        payload = json.loads(status_path.read_text())
        assert payload["success"] is success
        failures = [failure for step in payload["steps"] for failure in step["failures"] or []]
        assert [failure["name"] for failure in failures] == ([] if success else ["bum"])
