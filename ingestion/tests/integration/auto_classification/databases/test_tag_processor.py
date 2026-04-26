import uuid

import pytest
from dirty_equals import Contains, HasAttributes, IsInstance

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.generated.schema.entity.classification.tag import Tag
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
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow
from metadata.workflow.metadata import MetadataWorkflow


@pytest.fixture(scope="module")
def create_service_request(postgres_container: PostgresConnection):
    return CreateDatabaseServiceRequest(
        name=f"docker_test_postgres_{uuid.uuid4().hex[:8]}",
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
    """Get the bot ometa"""
    automator_bot: User = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    automator_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=automator_bot.id
    )

    return int_admin_ometa(jwt=automator_bot_auth.config.JWTToken.get_secret_value())


@pytest.fixture(scope="module")
def bot_workflow_config(bot_metadata, workflow_config):
    bot_workflow_config = workflow_config.copy()
    bot_workflow_config["openMetadataServerConfig"] = bot_metadata.config.model_dump()
    return bot_workflow_config


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


@pytest.fixture(scope="module")
def run_autoclassification(
    pii_classification: Classification,
    sensitive_pii_tag: Tag,
    non_sensitive_pii_tag: Tag,
    run_workflow,
    load_metadata: MetadataWorkflow,
    autoclassification_config,
) -> AutoClassificationWorkflow:
    return run_workflow(AutoClassificationWorkflow, autoclassification_config)


def test_it_returns_the_expected_classifications(
    db_service: DatabaseService,
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
) -> None:
    (
        address_column,
        customer_id_column,
        dwh_x10_column,
        dwh_x20_column,
        nhs_number_column,
        order_date_column,
        timestamp_column,
        user_name_column,
        version_column,
    ) = metadata.get_table_columns(
        f"{db_service.fullyQualifiedName.root}.test_db.public.example_table",
        fields=["tags"],
    )

    assert customer_id_column.tags == []
    assert nhs_number_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains(
                "Detected by `ContextAwareNhsRecognizer`", "Patterns matched:"
            ),
        ),
    ]
    assert dwh_x10_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `EmailRecognizer`", "Patterns matched:"),
        ),
    ]
    assert user_name_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `SpacyRecognizer`"),
        ),
    ]
    assert address_column.tags == []
    assert dwh_x20_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains(
                "Detected by `SanitizedCreditCardRecognizer`", "Patterns matched:"
            ),
        ),
    ]
    assert timestamp_column.tags == []
    assert version_column.tags == []
    assert order_date_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.NonSensitive"),
            reason=Contains(
                "Detected by `ValidatedDateRecognizer`", "Patterns matched:"
            ),
        ),
    ]
