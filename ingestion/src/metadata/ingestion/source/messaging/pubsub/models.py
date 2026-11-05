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
Pub/Sub Models
"""

from pydantic import BaseModel


class PubSubBigQueryConfig(BaseModel):
    """
    Model for BigQuery subscription configuration
    """

    table: str | None = None
    use_topic_schema: bool | None = None
    write_metadata: bool | None = None
    drop_unknown_fields: bool | None = None


class PubSubSubscription(BaseModel):
    """
    Model for Pub/Sub Subscription metadata
    """

    name: str
    ack_deadline_seconds: int | None = None
    message_retention_duration: float | None = None
    dead_letter_topic: str | None = None
    push_endpoint: str | None = None
    filter: str | None = None
    bigquery_config: PubSubBigQueryConfig | None = None
    enable_exactly_once_delivery: bool | None = None


class PubSubSchemaInfo(BaseModel):
    """
    Model for Pub/Sub Schema information
    """

    name: str
    schema_type: str
    definition: str | None = None
    revision_id: str | None = None


class PubSubTopicMetadata(BaseModel):
    """
    Model for Pub/Sub Topic Metadata
    """

    name: str
    labels: dict[str, str] | None = None
    message_retention_duration: float | None = None
    schema_settings: PubSubSchemaInfo | None = None
    subscriptions: list[PubSubSubscription] | None = None
    ordering_enabled: bool = False
    kms_key_name: str | None = None
