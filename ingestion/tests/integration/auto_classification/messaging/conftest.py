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
Shared fixtures for messaging auto-classification integration tests.

Kafka: Full implementation. Tests cover SASL/SSL auth, global timeout, FQN parsing.
Redpanda: Kafka-protocol compatible. Delegates to KafkaSampler; see test_redpanda_classification.py.
Kinesis: Stub implementation (not yet implemented); no tests available.
PubSub: Stub implementation (not yet implemented); no tests available.
"""

import json
import uuid

import pytest

from _openmetadata_testutils.factories.metadata.generated.schema.api.classification.create_classification import (
    CreateClassificationRequestFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.api.classification.create_tag import (
    CreateTagRequestFactory,
)
from _openmetadata_testutils.factories.metadata.generated.schema.type.recognizer import (
    RecognizerFactory,
)
from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
    ConflictResolution,
)
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.messaging.kafkaConnection import (
    KafkaConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
    MessagingServiceType,
)
from metadata.generated.schema.entity.teams.user import AuthenticationMechanism, User
from metadata.generated.schema.type import schema
from metadata.generated.schema.type.predefinedRecognizer import Name
from metadata.generated.schema.type.recognizer import Recognizer
from metadata.generated.schema.type.schema import DataTypeTopic, FieldModel, SchemaType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.classification import AutoClassificationWorkflow

from ...kafka.conftest import CustomKafkaContainer  # noqa: TID252

# Import root conftest fixtures
pytest_plugins = ["ingestion.tests.integration.conftest"]

PII_TOPIC_NAME = "test-pii-customers"
NON_PII_TOPIC_NAME = "test-non-pii-orders"

PII_MESSAGES = [
    {
        "customer_id": "1",
        "name": "John Smith",
        "email": "john.smith@example.com",
        "phone": "+1-555-123-4567",
        "ssn": "479-13-8850",
        "credit_card": "4242-4242-4242-4242",
    },
    {
        "customer_id": "2",
        "name": "Alice Johnson",
        "email": "alice.j@company.org",
        "phone": "+1-555-987-6543",
        "ssn": "153-10-3105",
        "credit_card": "5555-5555-5555-4444",
    },
    {
        "customer_id": "3",
        "name": "Bob Williams",
        "email": "bob.w@test.com",
        "phone": "+1-555-246-8135",
        "ssn": "456-78-9012",
        "credit_card": "4000-0566-5566-5556",
    },
    {
        "customer_id": "4",
        "name": "Carol Davis",
        "email": "carol.davis@mail.net",
        "phone": "+1-555-369-2580",
        "ssn": "234-56-7890",
        "credit_card": "2223-0031-2200-3222",
    },
    {
        "customer_id": "5",
        "name": "David Brown",
        "email": "d.brown@domain.io",
        "phone": "+1-555-147-2589",
        "ssn": "345-67-8901",
        "credit_card": "5200-8282-8282-8210",
    },
]

NON_PII_MESSAGES = [
    {"order_id": "1001", "product_id": "PROD-A", "quantity": "2", "price": "29.99"},
    {"order_id": "1002", "product_id": "PROD-B", "quantity": "1", "price": "49.99"},
    {"order_id": "1003", "product_id": "PROD-C", "quantity": "5", "price": "9.99"},
    {"order_id": "1004", "product_id": "PROD-A", "quantity": "3", "price": "29.99"},
    {"order_id": "1005", "product_id": "PROD-D", "quantity": "1", "price": "99.99"},
]

PII_SCHEMA_FIELDS = [
    FieldModel(name="customer_id", dataType=DataTypeTopic.STRING),
    FieldModel(name="name", dataType=DataTypeTopic.STRING),
    FieldModel(name="email", dataType=DataTypeTopic.STRING),
    FieldModel(name="phone", dataType=DataTypeTopic.STRING),
    FieldModel(name="ssn", dataType=DataTypeTopic.STRING),
    FieldModel(name="credit_card", dataType=DataTypeTopic.STRING),
]

NON_PII_SCHEMA_FIELDS = [
    FieldModel(name="order_id", dataType=DataTypeTopic.STRING),
    FieldModel(name="product_id", dataType=DataTypeTopic.STRING),
    FieldModel(name="quantity", dataType=DataTypeTopic.STRING),
    FieldModel(name="price", dataType=DataTypeTopic.STRING),
]


def _produce_messages(bootstrap_server: str, topic_name: str, messages: list[dict]) -> None:
    from confluent_kafka import Producer

    producer = Producer({"bootstrap.servers": bootstrap_server})
    for message in messages:
        producer.produce(topic_name, value=json.dumps(message).encode("utf-8"))
    producer.flush()


@pytest.fixture(scope="module")
def kafka_container():
    with CustomKafkaContainer() as container:
        yield container


@pytest.fixture(scope="module")
def service_name():
    return f"kafka_autoclassification_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def messaging_service(metadata: OpenMetadata, kafka_container, service_name: str) -> MessagingService:
    service_entity = metadata.create_or_update(
        CreateMessagingServiceRequest(
            name=service_name,
            serviceType=MessagingServiceType.Kafka,
            connection=MessagingConnection(
                config=KafkaConnection(bootstrapServers=kafka_container.get_bootstrap_server())
            ),
        )
    )
    fqn = service_entity.fullyQualifiedName.root
    yield service_entity
    service_entity = metadata.get_by_name(MessagingService, fqn)
    if service_entity:
        metadata.delete(
            entity=MessagingService,
            entity_id=service_entity.id,
            hard_delete=True,
            recursive=True,
        )


@pytest.fixture(scope="module")
def kafka_pii_topic(metadata: OpenMetadata, kafka_container, messaging_service: MessagingService) -> Topic:
    _produce_messages(kafka_container.get_bootstrap_server(), PII_TOPIC_NAME, PII_MESSAGES)
    return metadata.create_or_update(
        CreateTopicRequest(
            name=PII_TOPIC_NAME,
            service=messaging_service.fullyQualifiedName,
            partitions=1,
            messageSchema=schema.Topic(
                schemaType=SchemaType.JSON,
                schemaFields=PII_SCHEMA_FIELDS,
            ),
        )
    )


@pytest.fixture(scope="module")
def kafka_non_pii_topic(metadata: OpenMetadata, kafka_container, messaging_service: MessagingService) -> Topic:
    _produce_messages(kafka_container.get_bootstrap_server(), NON_PII_TOPIC_NAME, NON_PII_MESSAGES)
    return metadata.create_or_update(
        CreateTopicRequest(
            name=NON_PII_TOPIC_NAME,
            service=messaging_service.fullyQualifiedName,
            partitions=1,
            messageSchema=schema.Topic(
                schemaType=SchemaType.JSON,
                schemaFields=NON_PII_SCHEMA_FIELDS,
            ),
        )
    )


@pytest.fixture(scope="module")
def bot_metadata(metadata: OpenMetadata) -> OpenMetadata:
    automator_bot: User = metadata.get_by_name(entity=User, fqn="ingestion-bot")
    automator_bot_auth: AuthenticationMechanism = metadata.get_by_id(
        entity=AuthenticationMechanism, entity_id=automator_bot.id
    )
    return int_admin_ometa(jwt=automator_bot_auth.config.JWTToken.get_secret_value())


@pytest.fixture(scope="module")
def bot_workflow_config(bot_metadata: OpenMetadata) -> dict:
    return {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": bot_metadata.config.model_dump(),
    }


@pytest.fixture(scope="module")
def sink_config() -> dict:
    return {"type": "metadata-rest", "config": {}}


@pytest.fixture(scope="module")
def autoclassification_config_pii(
    messaging_service: MessagingService, kafka_container, bot_workflow_config: dict, sink_config: dict
) -> dict:
    return {
        "source": {
            "type": "kafka",
            "serviceName": messaging_service.fullyQualifiedName.root,
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                    "bootstrapServers": kafka_container.get_bootstrap_server(),
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "topicFilterPattern": {"includes": [f"^{PII_TOPIC_NAME}$"]},
                    "storeSampleData": True,
                    "sampleDataCount": 50,
                    "enableAutoClassification": True,
                    "confidence": 80,
                }
            },
        },
        "processor": {"type": "tag-pii-processor", "config": {}},
        "sink": sink_config,
        "workflowConfig": bot_workflow_config,
    }


@pytest.fixture(scope="module")
def autoclassification_config_non_pii(
    messaging_service: MessagingService, kafka_container, bot_workflow_config: dict, sink_config: dict
) -> dict:
    return {
        "source": {
            "type": "kafka",
            "serviceName": messaging_service.fullyQualifiedName.root,
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                    "bootstrapServers": kafka_container.get_bootstrap_server(),
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "AutoClassification",
                    "topicFilterPattern": {"includes": [f"^{NON_PII_TOPIC_NAME}$"]},
                    "storeSampleData": True,
                    "sampleDataCount": 50,
                    "enableAutoClassification": True,
                    "confidence": 80,
                }
            },
        },
        "processor": {"type": "tag-pii-processor", "config": {}},
        "sink": sink_config,
        "workflowConfig": bot_workflow_config,
    }


@pytest.fixture(scope="module")
def email_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="email_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.EmailRecognizer,
    )


@pytest.fixture(scope="module")
def credit_card_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="credit_card_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.CreditCardRecognizer,
    )


@pytest.fixture(scope="module")
def us_ssn_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="us_ssn_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.UsSsnRecognizer,
    )


@pytest.fixture(scope="module")
def phone_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="phone_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.PhoneRecognizer,
    )


@pytest.fixture(scope="module")
def pii_spacy_recognizer() -> Recognizer:
    return RecognizerFactory.create(
        name="spacy_recognizer",
        recognizerConfig__type="predefined",
        recognizerConfig__name=Name.SpacyRecognizer,
    )


@pytest.fixture(scope="module")
def pii_classification(
    metadata: OpenMetadata[Classification, CreateClassificationRequest],
) -> Classification:
    create_classification_request = CreateClassificationRequestFactory.create(
        fqn="PII",
        autoClassificationConfig__conflictResolution=ConflictResolution.highest_priority.value,
    )
    return metadata.create_or_update(create_classification_request)


@pytest.fixture(scope="module")
def sensitive_pii_tag(
    metadata: OpenMetadata[Tag, CreateTagRequest],
    pii_classification: Classification,
    email_recognizer: Recognizer,
    credit_card_recognizer: Recognizer,
    us_ssn_recognizer: Recognizer,
    pii_spacy_recognizer: Recognizer,
) -> Tag:
    create_tag_request = CreateTagRequestFactory.create(
        tag_name="Sensitive",
        tag_classification=pii_classification.fullyQualifiedName.root,
        autoClassificationPriority=100,
        recognizers=[
            email_recognizer,
            credit_card_recognizer,
            us_ssn_recognizer,
            pii_spacy_recognizer,
        ],
    )
    return metadata.create_or_update(create_tag_request)


@pytest.fixture(scope="module")
def non_sensitive_pii_tag(
    metadata: OpenMetadata[Tag, CreateTagRequest],
    pii_classification: Classification,
    phone_recognizer: Recognizer,
    pii_spacy_recognizer: Recognizer,
) -> Tag:
    create_tag_request = CreateTagRequestFactory.create(
        tag_name="NonSensitive",
        tag_classification=pii_classification.fullyQualifiedName.root,
        autoClassificationPriority=80,
        recognizers=[
            phone_recognizer,
            pii_spacy_recognizer,
        ],
    )
    return metadata.create_or_update(create_tag_request)


@pytest.fixture(scope="module")
def run_workflow():
    def _run(workflow_type, config, raise_from_status=True):
        workflow = workflow_type.create(config)
        workflow.execute()
        if raise_from_status:
            workflow.print_status()
            workflow.raise_from_status()
        return workflow

    return _run


@pytest.fixture(scope="module")
def run_autoclassification_pii(
    pii_classification: Classification,
    sensitive_pii_tag: Tag,
    non_sensitive_pii_tag: Tag,
    run_workflow,
    kafka_pii_topic: Topic,
    autoclassification_config_pii: dict,
) -> AutoClassificationWorkflow:
    return run_workflow(AutoClassificationWorkflow, autoclassification_config_pii, raise_from_status=False)


@pytest.fixture(scope="module")
def run_autoclassification_non_pii(
    pii_classification: Classification,
    sensitive_pii_tag: Tag,
    non_sensitive_pii_tag: Tag,
    run_workflow,
    kafka_non_pii_topic: Topic,
    autoclassification_config_non_pii: dict,
) -> AutoClassificationWorkflow:
    return run_workflow(AutoClassificationWorkflow, autoclassification_config_non_pii, raise_from_status=False)
