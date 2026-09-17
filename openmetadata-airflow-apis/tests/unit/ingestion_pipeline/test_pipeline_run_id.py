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
Runs triggered from the server report under the server's run id.

The server records a triggered run as queued under the run id it sends in the trigger conf. The
DAG mints its own id when it is parsed, so unless the task adopts the server's id, the worker's
statuses land on a different run and the queued one never progresses.
"""

import uuid
from types import SimpleNamespace

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline as SuitePipelineConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import Source, SourceConfig
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from openmetadata_managed_apis.workflows.ingestion import common, test_suite


@pytest.fixture
def suite_task(monkeypatch):
    """A built test-suite task whose Airflow execution is stubbed to report the run id it would use."""
    source_config = SourceConfig(
        config=SuitePipelineConfig(type="TestSuite", entityFullyQualifiedName="svc.db.schema.orders")
    )
    monkeypatch.setattr(
        test_suite,
        "build_source",
        lambda _: Source(type="testSuite", serviceName="orders_suite", sourceConfig=source_config),
    )
    monkeypatch.setattr(
        common.PythonOperator,
        "execute",
        lambda operator, context: operator.op_kwargs["workflow_config"].pipelineRunId,
    )
    pipeline = IngestionPipeline(
        id=uuid.uuid4(),
        name="orders_suite_pipeline",
        fullyQualifiedName="orders_suite.orders_suite_pipeline",
        pipelineType=PipelineType.TestSuite,
        sourceConfig=source_config,
        airflowConfig=AirflowConfig(scheduleInterval=None),
        service=EntityReference(id=uuid.uuid4(), type="testSuite", name="orders_suite"),
        openMetadataServerConnection=OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken="token"),
        ),
    )
    return test_suite.build_test_suite_dag(pipeline).get_task("test_suite_task")


def _failure_callback_config(task):
    callbacks = task.on_failure_callback
    callback = callbacks[0] if isinstance(callbacks, list) else callbacks
    return callback.args[0]


def test_trigger_conf_run_id_replaces_the_one_minted_at_parse_time(suite_task):
    server_run_id = str(uuid.uuid4())

    reported = suite_task.execute({"params": {"pipelineRunId": server_run_id}})

    assert str(reported.root) == server_run_id


def test_failure_callback_reports_under_the_same_run_id(suite_task):
    server_run_id = str(uuid.uuid4())

    suite_task.execute({"params": {"pipelineRunId": server_run_id}})

    assert str(_failure_callback_config(suite_task).pipelineRunId.root) == server_run_id


def test_without_a_trigger_run_id_the_parse_time_id_is_kept(suite_task):
    parse_time_run_id = suite_task.op_kwargs["workflow_config"].pipelineRunId

    reported = suite_task.execute({"params": {"pipelineRunId": None}})

    assert reported == parse_time_run_id


def test_dag_declares_the_run_id_param_next_to_its_own_params(suite_task):
    assert suite_task.params["pipelineRunId"] is None
    assert suite_task.params["testCases"] is None


@pytest.fixture
def failure_reports(monkeypatch):
    """Collect the configs the failure callback would report instead of calling the server."""
    reported = []
    monkeypatch.setattr(common, "send_failed_status_callback", reported.append)
    return reported


def _dag_failure_callback(task):
    callbacks = task.dag.on_failure_callback
    return callbacks[0] if isinstance(callbacks, list) else callbacks


def test_dag_failure_reports_under_the_trigger_conf_run_id(suite_task, failure_reports):
    """A task killed before it starts never runs its own callback; the DAG-level one must still
    fail the run the server recorded as queued, or on-demand runs stay blocked until it times out."""
    server_run_id = str(uuid.uuid4())

    _dag_failure_callback(suite_task)({"dag_run": SimpleNamespace(conf={"pipelineRunId": server_run_id})})

    assert [str(config.pipelineRunId.root) for config in failure_reports] == [server_run_id]
    assert failure_reports[0].ingestionPipelineFQN == suite_task.op_kwargs["workflow_config"].ingestionPipelineFQN


def test_dag_failure_falls_back_to_params_without_a_dag_run(suite_task, failure_reports):
    server_run_id = str(uuid.uuid4())

    _dag_failure_callback(suite_task)({"params": {"pipelineRunId": server_run_id}})

    assert [str(config.pipelineRunId.root) for config in failure_reports] == [server_run_id]


def test_dag_failure_of_a_scheduled_run_reports_nothing(suite_task, failure_reports):
    _dag_failure_callback(suite_task)({"dag_run": SimpleNamespace(conf={}), "params": {"pipelineRunId": None}})

    assert failure_reports == []


def test_dag_failure_does_not_change_the_config_the_task_shares(suite_task, failure_reports):
    parse_time_run_id = suite_task.op_kwargs["workflow_config"].pipelineRunId

    _dag_failure_callback(suite_task)({"dag_run": SimpleNamespace(conf={"pipelineRunId": str(uuid.uuid4())})})

    assert suite_task.op_kwargs["workflow_config"].pipelineRunId == parse_time_run_id
