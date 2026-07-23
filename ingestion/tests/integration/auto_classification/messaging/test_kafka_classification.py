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
Integration tests for Kafka auto-classification workflow.

Verifies that the AutoClassificationWorkflow correctly:
  - samples messages from Kafka topics,
  - stores sample data on the Topic entity,
  - tags schema fields containing PII data, and
  - leaves non-PII fields untagged.
"""

import pytest

pytest.importorskip("confluent_kafka", reason="confluent_kafka not installed; skipping Kafka tests")

from ingestion.tests.integration.auto_classification.messaging.conftest import (
    NON_PII_TOPIC_NAME,
    PII_TOPIC_NAME,
)
from metadata.generated.schema.entity.data.topic import Topic
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.workflow_status_mixin import WorkflowResultStatus


class TestKafkaAutoClassification:
    def test_topic_entity_exists(self, metadata: OpenMetadata, messaging_service, kafka_pii_topic):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
        )
        assert topic is not None
        assert topic.name.root == PII_TOPIC_NAME

    def test_email_field_tagged_pii_sensitive(
        self,
        metadata: OpenMetadata,
        messaging_service,
        run_autoclassification_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
            fields=["messageSchema", "tags"],
        )
        assert topic.messageSchema is not None
        fields = topic.messageSchema.schemaFields
        email_field = next((f for f in fields if f.name.root == "email"), None)
        assert email_field is not None
        assert email_field.tags is not None
        assert any(tag.tagFQN.root == "PII.Sensitive" for tag in email_field.tags), (
            "email field should be tagged as PII.Sensitive"
        )

    def test_ssn_field_tagged_pii_sensitive(
        self,
        metadata: OpenMetadata,
        messaging_service,
        run_autoclassification_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
            fields=["messageSchema", "tags"],
        )
        fields = topic.messageSchema.schemaFields
        ssn_field = next((f for f in fields if f.name.root == "ssn"), None)
        assert ssn_field is not None
        assert ssn_field.tags is not None
        assert any(tag.tagFQN.root == "PII.Sensitive" for tag in ssn_field.tags)

    def test_credit_card_field_tagged_pii_sensitive(
        self,
        metadata: OpenMetadata,
        messaging_service,
        run_autoclassification_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
            fields=["messageSchema", "tags"],
        )
        fields = topic.messageSchema.schemaFields
        cc_field = next((f for f in fields if f.name.root == "credit_card"), None)
        assert cc_field is not None
        assert cc_field.tags is not None
        assert any(tag.tagFQN.root == "PII.Sensitive" for tag in cc_field.tags)

    def test_non_pii_field_not_tagged(
        self,
        metadata: OpenMetadata,
        messaging_service,
        run_autoclassification_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{messaging_service.fullyQualifiedName.root}.{PII_TOPIC_NAME}",
            fields=["messageSchema", "tags"],
        )
        fields = topic.messageSchema.schemaFields
        id_field = next((f for f in fields if f.name.root == "customer_id"), None)
        assert id_field is not None
        assert id_field.tags is None or len(id_field.tags) == 0, "customer_id should not have PII tags"

    def test_non_pii_topic_fields_not_tagged(
        self,
        metadata: OpenMetadata,
        messaging_service,
        run_autoclassification_non_pii,
    ):
        topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{messaging_service.fullyQualifiedName.root}.{NON_PII_TOPIC_NAME}",
            fields=["messageSchema", "tags"],
        )
        fields = topic.messageSchema.schemaFields
        for field in fields:
            assert field.tags is None or len(field.tags) == 0, (
                f"Non-PII field {field.name.root} should not have PII tags"
            )

    def test_workflow_completes_successfully(
        self,
        run_autoclassification_pii,
    ):
        assert run_autoclassification_pii.result_status() is WorkflowResultStatus.SUCCESS
