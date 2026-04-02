"""Integration tests for global sample data configuration.

Verifies that the global profiler configuration ``storeSampleData`` flag
controls whether sample data is persisted when running the auto-classification
workflow.
"""

import uuid

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
    SampleDataIngestionConfig,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseMetadataConfigType,
)
from metadata.generated.schema.settings.settings import Settings, SettingType
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow

TABLE_FQN_SUFFIX = "test_db.public.example_table"


@pytest.fixture(scope="module")
def create_service_request(postgres_container):
    return CreateDatabaseServiceRequest(
        name=f"sample_data_test_{uuid.uuid4().hex[:8]}",
        serviceType=DatabaseServiceType.Postgres,
        connection=DatabaseConnection(
            config=PostgresConnection(
                username=postgres_container.username,
                authType=BasicAuth(password=postgres_container.password),
                hostPort=postgres_container.get_container_host_ip()
                + ":"
                + str(postgres_container.get_exposed_port(postgres_container.port)),
                database=postgres_container.dbname,
            )
        ),
    )


@pytest.fixture(scope="module")
def ingestion_config(db_service, metadata, workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": DatabaseMetadataConfigType.DatabaseMetadata.value,
                    "tableFilterPattern": FilterPattern(includes=["^example_table$"]),
                }
            },
            "serviceConnection": db_service.connection.model_dump(),
        },
        "sink": sink_config,
        "workflowConfig": workflow_config,
    }


@pytest.fixture(scope="module")
def load_metadata(run_workflow, ingestion_config) -> MetadataWorkflow:
    return run_workflow(MetadataWorkflow, ingestion_config)


@pytest.fixture(scope="module")
def bot_metadata(metadata) -> OpenMetadata:
    automator_bot: User = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    automator_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=automator_bot.id
    )
    return int_admin_ometa(jwt=automator_bot_auth.config.JWTToken.get_secret_value())


@pytest.fixture(scope="module")
def bot_workflow_config(bot_metadata, workflow_config):
    bot_wf_config = workflow_config.copy()
    bot_wf_config["openMetadataServerConfig"] = bot_metadata.config.model_dump()
    return bot_wf_config


@pytest.fixture(scope="module")
def table_fqn(db_service):
    return f"{db_service.fullyQualifiedName.root}.{TABLE_FQN_SUFFIX}"


@pytest.fixture(scope="module")
def autoclassification_config(db_service, bot_workflow_config, sink_config):
    return {
        "source": {
            "type": db_service.connection.config.type.value.lower(),
            "serviceName": db_service.fullyQualifiedName.root,
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "tableFilterPattern": FilterPattern(includes=["^example_table$"]),
                    "storeSampleData": True,
                }
            },
        },
        "processor": {
            "type": "tag-pii-processor",
            "config": {},
        },
        "sink": sink_config,
        "workflowConfig": bot_workflow_config,
    }


@pytest.fixture(autouse=True)
def clean_sample_data(metadata, table_fqn):
    """Delete sample data before and after each test so results are isolated."""
    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    if table:
        metadata.delete_sample_data(table)
    yield
    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    if table:
        metadata.delete_sample_data(table)


@pytest.fixture(scope="module", autouse=True)
def _cleanup_profiler_config(metadata):
    """Reset the global profiler configuration after all tests in this module."""
    yield
    metadata.create_or_update_settings(
        Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=ProfilerConfiguration(
                sampleDataConfig=None,
            ),
        )
    )


def _set_global_profiler_config(metadata: OpenMetadata, store: bool):
    """Set the global profiler configuration for sample data."""
    metadata.create_or_update_settings(
        Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=ProfilerConfiguration(
                sampleDataConfig=SampleDataIngestionConfig(
                    storeSampleData=store,
                    readSampleData=True,
                ),
            ),
        )
    )


def test_store_sample_data_when_global_config_enabled(
    db_service: DatabaseService,
    metadata: OpenMetadata,
    pii_classification: Classification,
    sensitive_pii_tag: Tag,
    non_sensitive_pii_tag: Tag,
    load_metadata: MetadataWorkflow,
    run_workflow,
    autoclassification_config,
    table_fqn,
):
    """When global storeSampleData is True, running the auto-classification
    workflow should persist sample data for the table."""
    _set_global_profiler_config(metadata, store=True)

    run_workflow(AutoClassificationWorkflow, autoclassification_config)

    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    result = metadata.get_sample_data(table)

    assert result is not None, "Expected table with sample data"
    assert result.sampleData is not None, "Expected sampleData to be present"
    assert len(result.sampleData.rows) > 0, "Expected non-empty sample data rows"


def test_no_sample_data_when_global_config_disabled(
    db_service: DatabaseService,
    metadata: OpenMetadata,
    pii_classification: Classification,
    sensitive_pii_tag: Tag,
    non_sensitive_pii_tag: Tag,
    load_metadata: MetadataWorkflow,
    run_workflow,
    autoclassification_config,
    table_fqn,
):
    """When global storeSampleData is False, running the auto-classification
    workflow with storeSampleData=True in the source config should NOT persist
    sample data — the global setting overrides the source config."""
    _set_global_profiler_config(metadata, store=False)

    run_workflow(AutoClassificationWorkflow, autoclassification_config)

    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    result = metadata.get_sample_data(table)

    has_sample_data = (
        result is not None
        and result.sampleData is not None
        and len(result.sampleData.rows) > 0
    )
    assert (
        not has_sample_data
    ), "Expected no sample data when global storeSampleData is disabled"
