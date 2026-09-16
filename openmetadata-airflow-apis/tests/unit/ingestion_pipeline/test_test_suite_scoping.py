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
Scoped runs of a test-suite DAG ("Run now" on a single test case).

Airflow bakes a DAG's config at deploy time, so the only channel for an ad-hoc scope is the
trigger conf: the DAG declares a ``testCases`` param, Airflow merges the trigger conf into it,
and the workflow narrows ``sourceConfig.config.testCases`` before the suite runs.
"""

import uuid
from unittest.mock import MagicMock

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
from metadata.generated.schema.metadataIngestion.workflow import (
    LogLevels,
    OpenMetadataWorkflowConfig,
    Processor,
    Sink,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from openmetadata_managed_apis.workflows.ingestion import test_suite

SCOPED_TEST_CASES = ["table_row_count_to_equal"]


@pytest.fixture
def workflow_configs(monkeypatch):
    """Stub the workflow boundary and collect the config each run would execute."""
    executed = []

    class RecordingWorkflow:
        @classmethod
        def create(cls, config):
            executed.append(config)
            return MagicMock()

    monkeypatch.setattr(test_suite, "TestSuiteWorkflow", RecordingWorkflow)
    monkeypatch.setattr(test_suite, "execute_workflow", lambda *_, **__: None)
    monkeypatch.setattr(test_suite, "set_operator_logger", lambda *_, **__: None)
    return executed


def _source_config():
    return SourceConfig(config=SuitePipelineConfig(type="TestSuite", entityFullyQualifiedName="svc.db.schema.orders"))


def _server_connection():
    return OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="token"),
    )


def _workflow_config():
    return OpenMetadataWorkflowConfig(
        source=Source(type="testSuite", serviceName="orders_suite", sourceConfig=_source_config()),
        sink=Sink(type="metadata-rest", config={}),
        processor=Processor(type="orm-test-runner", config={}),
        workflowConfig=WorkflowConfig(loggerLevel=LogLevels.INFO, openMetadataServerConfig=_server_connection()),
        ingestionPipelineFQN="orders_suite.orders_suite_pipeline",
    )


def _scoped_test_cases(config):
    return config["source"]["sourceConfig"]["config"].get("testCases")


def test_trigger_conf_scopes_the_run_to_the_named_test_cases(workflow_configs):
    test_suite.test_suite_workflow(_workflow_config(), params={"testCases": SCOPED_TEST_CASES})

    assert _scoped_test_cases(workflow_configs[0]) == SCOPED_TEST_CASES


def test_without_trigger_conf_the_whole_suite_runs(workflow_configs):
    test_suite.test_suite_workflow(_workflow_config())

    assert _scoped_test_cases(workflow_configs[0]) is None


def test_empty_test_cases_conf_does_not_scope_the_run(workflow_configs):
    test_suite.test_suite_workflow(_workflow_config(), params={"testCases": []})

    assert _scoped_test_cases(workflow_configs[0]) is None


def test_dag_declares_the_test_cases_param_so_trigger_conf_can_override_it(monkeypatch):
    """Without the declared param the trigger conf has nothing to merge into, and a scoped run
    would silently execute the whole suite."""
    monkeypatch.setattr(
        test_suite,
        "build_source",
        lambda _: Source(type="testSuite", serviceName="orders_suite", sourceConfig=_source_config()),
    )
    pipeline = IngestionPipeline(
        id=uuid.uuid4(),
        name="orders_suite_pipeline",
        fullyQualifiedName="orders_suite.orders_suite_pipeline",
        pipelineType=PipelineType.TestSuite,
        sourceConfig=_source_config(),
        airflowConfig=AirflowConfig(scheduleInterval=None),
        service=EntityReference(id=uuid.uuid4(), type="testSuite", name="orders_suite"),
        openMetadataServerConnection=_server_connection(),
    )

    task_params = test_suite.build_test_suite_dag(pipeline).get_task("test_suite_task").params

    assert "testCases" in task_params
    assert task_params["testCases"] is None
