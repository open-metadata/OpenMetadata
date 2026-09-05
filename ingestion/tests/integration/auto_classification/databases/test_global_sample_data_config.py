"""Integration tests for global sample data configuration.

Verifies that the global profiler configuration ``storeSampleData`` flag
controls whether sample data is persisted when running the auto-classification
workflow.
"""

import uuid
from collections.abc import Generator

import pytest

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
    SampleDataIngestionConfig,
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
from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.generated.schema.type.patternRecognizer import PatternRecognizer
from metadata.generated.schema.type.recognizer import Recognizer, RecognizerConfig, Target
from metadata.generated.schema.type.recognizers.patterns import Pattern
from metadata.generated.schema.type.recognizers.regexFlags import RegexFlags
from metadata.generated.schema.type.tagLabel import LabelType, State
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.pii.constants import PII
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
                    "enableAutoClassification": True,
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


def _set_global_profiler_config(metadata: OpenMetadata, store: bool, read: bool = True):
    """Set the global profiler configuration for sample data."""
    metadata.create_or_update_settings(
        Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=ProfilerConfiguration(
                sampleDataConfig=SampleDataIngestionConfig(
                    storeSampleData=store,
                    readSampleData=read,
                ),
            ),
        )
    )


@pytest.fixture
def column_name_tag(metadata: OpenMetadata) -> Generator[Tag, None, None]:
    """A tag whose only recognizer matches on the column name, never on values.

    It has to live under the seeded ``PII`` classification: the workflow builds its
    processor with ``classification_filter=[PII]``, so tags from any other
    classification are dropped before they ever become candidates.
    """
    recognizer = Recognizer(
        name="AddressColumnNameRecognizer",
        recognizerConfig=RecognizerConfig(
            root=PatternRecognizer(
                type="pattern",
                patterns=[Pattern(name="address-column", regex=r"^address$", score=1.0)],
                regexFlags=RegexFlags(),
                supportedLanguage=ClassificationLanguage.en,
            )
        ),
        confidenceThreshold=0.8,
        target=Target.column_name,
    )
    tag = metadata.create_or_update(
        CreateTagRequest(
            name=f"ColumnNameOnly{uuid.uuid4().hex[:8]}",
            classification=PII,
            description="Metadata-only classification driven by the column name",
            recognizers=[recognizer],
            autoClassificationEnabled=True,
        )
    )

    try:
        yield tag
    finally:
        # PII is a seeded, system classification: drop only the tag we added, or
        # its column-name recognizer leaks into every later test on this server.
        metadata.delete(entity=Tag, entity_id=tag.id, recursive=True, hard_delete=True)


def test_store_sample_data_when_global_config_enabled(
    db_service: DatabaseService,
    metadata: OpenMetadata,
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

    has_sample_data = result is not None and result.sampleData is not None and len(result.sampleData.rows) > 0
    assert not has_sample_data, "Expected no sample data when global storeSampleData is disabled"


def test_column_name_classification_when_sample_data_access_disabled(
    metadata: OpenMetadata,
    load_metadata: MetadataWorkflow,
    run_workflow,
    autoclassification_config,
    table_fqn,
    column_name_tag: Tag,
):
    """A column-name recognizer must still propose its tag when the pipeline is
    forbidden from both reading and storing sample values."""
    _set_global_profiler_config(metadata, store=False, read=False)

    run_workflow(AutoClassificationWorkflow, autoclassification_config)

    table = metadata.get_by_name(entity=Table, fqn=table_fqn)
    sample_data = metadata.get_sample_data(table)
    has_sample_data = (
        sample_data is not None and sample_data.sampleData is not None and len(sample_data.sampleData.rows) > 0
    )
    assert not has_sample_data, "Expected no sample data when reading and storing are both disabled"

    columns = metadata.get_table_columns(table_fqn, fields=["tags"])
    # Postgres folds unquoted identifiers, so init.sql's ADDRESS arrives as `address`.
    address_column = next(column for column in columns if column.name.root == "address")
    matching_tags = [tag for tag in address_column.tags or [] if tag.tagFQN.root == column_name_tag.fullyQualifiedName]

    assert len(matching_tags) == 1, f"Expected the column-name tag on `address`, got {address_column.tags}"
    assert matching_tags[0].labelType is LabelType.Generated
    assert matching_tags[0].state is State.Suggested
