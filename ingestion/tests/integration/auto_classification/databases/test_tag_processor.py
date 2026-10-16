import uuid
from copy import deepcopy

import pytest
from dirty_equals import Contains, HasAttributes, IsInstance

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
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
from metadata.generated.schema.type.classificationLanguages import ClassificationLanguage
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.generated.schema.type.predefinedRecognizer import Name
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
                    "tableFilterPattern": FilterPattern(
                        includes=["^(example_table|card_prefix_cases|identifier_en|identifier_es|identifier_it)$"]
                    ),
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
                    "tableFilterPattern": FilterPattern(includes=["^(example_table|card_prefix_cases)$"]),
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
    run_workflow,
    load_metadata: MetadataWorkflow,
    autoclassification_config,
) -> AutoClassificationWorkflow:
    # Workflow creation replaces dict config values with models; keep the shared fixture reusable.
    return run_workflow(AutoClassificationWorkflow, deepcopy(autoclassification_config))


def test_it_returns_the_expected_classifications(
    db_service: DatabaseService,
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
) -> None:
    columns = {
        column.name.root.lower(): column
        for column in metadata.get_table_columns(
            f"{db_service.fullyQualifiedName.root}.test_db.public.example_table",
            fields=["tags"],
        )
    }
    academic_year_code_column = columns["academic_year_code"]
    address_column = columns["address"]
    card_note_column = columns["card_note"]
    customer_id_column = columns["customer_id"]
    dwh_x10_column = columns["dwh_x10"]
    dwh_x20_column = columns["dwh_x20"]
    nhs_number_column = columns["nhs_number"]
    order_date_column = columns["order_date"]
    service_url_column = columns["service_url"]
    session_ip_column = columns["session_ip"]
    timestamp_column = columns["timestamp"]
    user_name_column = columns["user_name"]
    version_column = columns["version"]

    assert customer_id_column.tags == []
    assert nhs_number_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `NhsRecognizer`", "Patterns matched:"),
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
    # SpacyRecognizer reads a street name as a PERSON in 2 of the 8 rows and as a LOCATION in 3.
    # Neither survived the old sample-size average; scoring on the strongest single match means a
    # column of postal addresses is now flagged, which is what it is.
    assert address_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `SpacyRecognizer`"),
        ),
    ]
    assert dwh_x20_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `CreditCardRecognizer`", "Patterns matched:"),
        ),
    ]
    assert timestamp_column.tags == []
    assert version_column.tags == []
    assert order_date_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.NonSensitive"),
            reason=Contains("Detected by `DateRecognizer`", "Patterns matched:"),
        ),
    ]
    # SpacyRecognizer's DATE_TIME entity flags 4-digit year-like integers regardless of column
    # type or semantics (#29083); date_time_patcher now drops them because a bare year names no
    # month or day.
    assert academic_year_code_column.tags == []
    assert card_note_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `CreditCardRecognizer`", "Patterns matched:"),
        ),
    ]
    assert service_url_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.NonSensitive"),
            reason=Contains("Detected by `UrlRecognizer`", "Patterns matched:"),
        ),
    ]
    assert session_ip_column.tags == [
        IsInstance(TagLabel)
        & HasAttributes(
            tagFQN=HasAttributes(root="PII.Sensitive"),
            reason=Contains("Detected by `IpRecognizer`", "Patterns matched:"),
        ),
    ]


def test_card_prefix_classifications_preserve_configured_metadata(
    db_service: DatabaseService,
    metadata: OpenMetadata,
    run_autoclassification: AutoClassificationWorkflow,
) -> None:
    tag = metadata.get_by_name(entity=Tag, fqn="PII.Sensitive", fields=["recognizers"])
    card_recognizer = next(
        recognizer for recognizer in tag.recognizers if recognizer.name.root == "EnglishCreditCardRecognizer"
    )
    columns = {
        column.name.root: column
        for column in metadata.get_table_columns(
            f"{db_service.fullyQualifiedName.root}.test_db.public.card_prefix_cases", fields=["tags"]
        )
    }
    for name in ("date_compact", "date_spaced", "date_dashed", "qty_spaced", "quantity_diners", "quantity_19"):
        assert len(columns[name].tags) == 1, name
        label = columns[name].tags[0]
        assert label.tagFQN.root == "PII.Sensitive", name
        assert "Detected by `CreditCardRecognizer`" in label.reason, name
        assert label.metadata is not None, name
        evidence = label.metadata.recognizer
        assert evidence.recognizerId == card_recognizer.id, name
        assert evidence.recognizerName == "CreditCardRecognizer", name
        assert evidence.score == 1.0, name
        assert evidence.patterns, name
        assert [(pattern.name, pattern.score) for pattern in evidence.patterns] == [("Credit Card Number", 1.0)], name
    for name in ("invalid_date", "invalid_checksum", "unlabeled_number", "compact_short_suffix", "spaced_short_suffix"):
        assert all(
            label.metadata is None or label.metadata.recognizer.recognizerId != card_recognizer.id
            for label in columns[name].tags
        ), name


@pytest.mark.parametrize(
    "language,table_name,expected",
    [
        (
            ClassificationLanguage.en,
            "identifier_en",
            {
                "iban": ["PII.Sensitive"],
                "uen": ["PII.Sensitive"],
                "abn": ["PII.Sensitive"],
                "acn": ["PII.Sensitive"],
                "sg_nric": ["PII.Sensitive"],
                "sku": [],
                "ticket_id": [],
                "shipment_ref": [],
            },
        ),
        (ClassificationLanguage.es, "identifier_es", {"nif": ["PII.Sensitive"], "nie": ["PII.Sensitive"]}),
        (ClassificationLanguage.it, "identifier_it", {"partita_iva": ["PII.Sensitive"]}),
    ],
)
def test_identifier_formats_are_persisted_by_classification_workflow(
    language: ClassificationLanguage,
    table_name: str,
    expected: dict[str, list[str]],
    db_service: DatabaseService,
    metadata: OpenMetadata,
    load_metadata: MetadataWorkflow,
    autoclassification_config: dict,
    run_workflow,
) -> None:
    config = deepcopy(autoclassification_config)
    source_config = config["source"]["sourceConfig"]["config"]
    source_config["tableFilterPattern"] = FilterPattern(includes=[f"^{table_name}$"])
    source_config["classificationLanguage"] = language
    source_config["confidence"] = 80
    run_workflow(AutoClassificationWorkflow, config)

    columns = metadata.get_table_columns(
        f"{db_service.fullyQualifiedName.root}.{db_service.connection.config.database}.public.{table_name}",
        fields=["tags"],
    )
    by_name = {column.name.root: column for column in columns}
    for name, tag_fqns in expected.items():
        assert [label.tagFQN.root for label in by_name[name].tags] == tag_fqns

    if language is ClassificationLanguage.en:
        recognizer_name = Name.SgFinRecognizer.value
        tag = metadata.get_by_name(entity=Tag, fqn="PII.Sensitive", fields=["recognizers"])
        configured_recognizer = next(
            recognizer for recognizer in tag.recognizers if recognizer.name.root == recognizer_name
        )
        label = by_name["sg_nric"].tags[0]
        assert f"Detected by `{recognizer_name}`" in (label.reason or "")
        assert label.metadata is not None
        evidence = label.metadata.recognizer
        assert evidence.recognizerId == configured_recognizer.id
        assert evidence.recognizerName == recognizer_name
        assert evidence.score == 1.0
        assert evidence.patterns
        assert any(pattern.name == "Nric (medium)" for pattern in evidence.patterns)
        assert all(0 < pattern.score <= 1.0 for pattern in evidence.patterns)
        assert all(
            f"Detected by `{recognizer_name}`" not in (label.reason or "")
            and (label.metadata is None or label.metadata.recognizer.recognizerId != configured_recognizer.id)
            for label in by_name["sg_nric_typo"].tags
        )
