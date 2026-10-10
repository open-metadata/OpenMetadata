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
Runs scoped to one entity ("Run now" on a test case, or profiling one table).

Airflow bakes a DAG's config at deploy time, so the only channel for what applies to a single run
is the trigger conf: every DAG declares a ``sourceConfigOverride`` param, Airflow merges the
trigger conf into it, and the operator lays it over the deployed source config before the workflow
runs. Top-level keys of the override replace the deployed ones.
"""

import uuid

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    AirflowConfig,
    IngestionPipeline,
    PipelineType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline as SuitePipelineConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import Source, SourceConfig
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.filterPattern import FilterPattern
from openmetadata_managed_apis.workflows.ingestion import auto_classification, common, metadata, test_suite

TABLE_FQN_PATTERN = r"^mysql_svc\.shop\.sales\.orders$"


def _server_connection():
    return OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="token"),
    )


def _pipeline(name, pipeline_type, source_config, service_type):
    return IngestionPipeline(
        id=uuid.uuid4(),
        name=name,
        fullyQualifiedName=f"svc.{name}",
        pipelineType=pipeline_type,
        sourceConfig=source_config,
        airflowConfig=AirflowConfig(scheduleInterval=None),
        service=EntityReference(id=uuid.uuid4(), type=service_type, name="svc"),
        openMetadataServerConnection=_server_connection(),
    )


@pytest.fixture(autouse=True)
def config_the_task_would_run(monkeypatch):
    """Stub Airflow's execution so a task reports the workflow config it would run with."""
    monkeypatch.setattr(
        common.PythonOperator,
        "execute",
        lambda operator, context: operator.op_kwargs["workflow_config"],
    )


@pytest.fixture
def suite_task(monkeypatch):
    source_config = SourceConfig(
        config=SuitePipelineConfig(type="TestSuite", entityFullyQualifiedName="svc.db.schema.orders")
    )
    monkeypatch.setattr(
        test_suite,
        "build_source",
        lambda _: Source(type="testSuite", serviceName="orders_suite", sourceConfig=source_config),
    )
    pipeline = _pipeline("orders_suite_pipeline", PipelineType.TestSuite, source_config, "testSuite")
    return test_suite.build_test_suite_dag(pipeline).get_task("test_suite_task")


@pytest.fixture
def metadata_task(monkeypatch):
    source_config = SourceConfig(
        config=DatabaseServiceMetadataPipeline(
            markDeletedTables=True,
            includeTags=False,
            tableFilterPattern=FilterPattern(includes=["orders.*"]),
        )
    )
    monkeypatch.setattr(
        metadata,
        "build_source",
        lambda _: Source(type="mysql", serviceName="mysql_svc", sourceConfig=source_config),
    )
    pipeline = _pipeline("mysql_metadata", PipelineType.metadata, source_config, "databaseService")
    return metadata.build_metadata_dag(pipeline).get_task("ingestion_task")


@pytest.fixture
def auto_classification_task(monkeypatch):
    # As Airflow stores a database service's auto classification config once deployed: it has no
    # database-only field, so it parsed as the messaging variant and was written back with its fields.
    source_config = SourceConfig.model_validate(
        {
            "config": {
                "type": "AutoClassification",
                "classificationFilterPattern": None,
                "topicFilterPattern": None,
                "useFqnForFiltering": False,
                "storeSampleData": True,
                "enableAutoClassification": True,
                "confidence": 80.0,
                "sampleDataCount": 50,
                "classificationLanguage": "en",
            }
        }
    )
    monkeypatch.setattr(
        auto_classification,
        "build_source",
        lambda _: Source(type="sqlite", serviceName="sqlite_svc", sourceConfig=source_config),
    )
    pipeline = _pipeline("sqlite_classification", PipelineType.autoClassification, source_config, "databaseService")
    return auto_classification.build_auto_classification_dag(pipeline).get_task("auto_classification_task")


def _run(task, override):
    return task.execute({"params": {"sourceConfigOverride": override}})


def test_trigger_conf_override_scopes_a_test_suite_run_to_one_test_case(suite_task):
    config = _run(suite_task, {"testCases": ["table_row_count_to_equal"]}).source.sourceConfig.config

    assert [name.root for name in config.testCases] == ["table_row_count_to_equal"]
    assert config.entityFullyQualifiedName.root == "svc.db.schema.orders"


def test_without_an_override_the_deployed_config_runs(suite_task):
    assert _run(suite_task, None).source.sourceConfig.config.testCases is None


def test_an_empty_override_does_not_change_the_run(suite_task):
    assert _run(suite_task, {}).source.sourceConfig.config.testCases is None


def test_override_narrows_a_metadata_run_and_keeps_the_rest_of_its_config(metadata_task):
    """The same override path serves every DAG type; the metadata scope must also stop the run
    from marking the tables it no longer sees as deleted."""
    config = _run(
        metadata_task,
        {
            "useFqnForFiltering": True,
            "tableFilterPattern": {"includes": [TABLE_FQN_PATTERN]},
            "markDeletedTables": False,
        },
    ).source.sourceConfig.config

    assert isinstance(config, DatabaseServiceMetadataPipeline)
    assert config.tableFilterPattern.includes == [TABLE_FQN_PATTERN]
    assert config.useFqnForFiltering is True
    assert config.markDeletedTables is False
    assert config.includeTags is False


def test_every_dag_declares_the_override_param_so_the_trigger_conf_can_set_it(suite_task, metadata_task):
    """Without the declared param the trigger conf has nothing to merge into, and a scoped run
    would silently run the whole pipeline."""
    assert suite_task.params["sourceConfigOverride"] is None
    assert metadata_task.params["sourceConfigOverride"] is None


def test_override_settles_which_config_a_sparse_deployed_one_is(auto_classification_task):
    """A deployed config that fits several variants must not pin the scoped one to the variant it
    first parsed as: the table filters the scope adds only fit the database variant."""
    config = _run(
        auto_classification_task,
        {"useFqnForFiltering": True, "tableFilterPattern": {"includes": [TABLE_FQN_PATTERN]}, "includeViews": True},
    ).source.sourceConfig.config

    assert isinstance(config, DatabaseServiceAutoClassificationPipeline)
    assert config.tableFilterPattern.includes == [TABLE_FQN_PATTERN]
    assert config.storeSampleData is True
