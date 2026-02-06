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
from typing import Dict, List, Optional

from pydantic import BaseModel


class PubSubBigQueryConfig(BaseModel):
    """
    Model for BigQuery subscription configuration
    """

    table: Optional[str] = None
    use_topic_schema: Optional[bool] = None
    write_metadata: Optional[bool] = None
    drop_unknown_fields: Optional[bool] = None


class PubSubSubscription(BaseModel):
    """
    Model for Pub/Sub Subscription metadata
    """

    name: str
    ack_deadline_seconds: Optional[int] = None
    message_retention_duration: Optional[str] = None
    dead_letter_topic: Optional[str] = None
    push_endpoint: Optional[str] = None
    filter: Optional[str] = None
    bigquery_config: Optional[PubSubBigQueryConfig] = None
    enable_exactly_once_delivery: Optional[bool] = None


class PubSubSchemaInfo(BaseModel):
    """
    Model for Pub/Sub Schema information
    """

    name: str
    schema_type: str
    definition: Optional[str] = None
    revision_id: Optional[str] = None


class PubSubTopicMetadata(BaseModel):
    """
    Model for Pub/Sub Topic Metadata
    """

    name: str
    labels: Optional[Dict[str, str]] = None
    message_retention_duration: Optional[str] = None
    schema_settings: Optional[PubSubSchemaInfo] = None
    subscriptions: Optional[List[PubSubSubscription]] = None
    ordering_enabled: bool = False
    kms_key_name: Optional[str] = None
