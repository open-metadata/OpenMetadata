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
"""Custom Messaging connector yielding deterministic in-memory topics."""

from collections.abc import Iterable

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.api.services.createMessagingService import (
    CreateMessagingServiceRequest,
)
from metadata.generated.schema.entity.data.topic import (
    CleanupPolicy,
    TopicSampleData,
)
from metadata.generated.schema.entity.data.topic import (
    Topic as TopicEntity,
)
from metadata.generated.schema.entity.services.connections.messaging.customMessagingConnection import (
    CustomMessagingConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import Source as WorkflowSource
from metadata.generated.schema.type.schema import (
    DataTypeTopic,
    FieldModel,
    SchemaType,
    Topic,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_topic_data import OMetaTopicSampleData
from metadata.ingestion.ometa.ometa_api import OpenMetadata

TOPICS: list[tuple[str, str, int, int]] = [
    ("my_orders_topic", "Order lifecycle events", 3, 2),
    ("my_clickstream_topic", "Raw page view events", 6, 3),
]

SAMPLE_MESSAGES = [
    '{"event_id": "evt-1", "event_ts": 1700000000000}',
    '{"event_id": "evt-2", "event_ts": 1700000060000}',
]


class CustomMessagingSource(Source):
    """Yields two topics with a message schema and sample data."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = config.serviceConnection.root.config

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "CustomMessagingSource":
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config
        if not isinstance(connection, CustomMessagingConnection):
            raise InvalidSourceException(f"Expected CustomMessagingConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def test_connection(self) -> None:
        """No external system to reach"""

    def close(self) -> None:
        """Nothing to close"""

    def _iter(self, *_, **__) -> Iterable[Either]:
        service_name = self.config.serviceName
        yield Either(
            right=CreateMessagingServiceRequest(
                name=service_name,
                serviceType=MessagingServiceType.CustomMessaging,
                connection=self.config.serviceConnection.root,
                displayName="Custom Messaging Demo",
                description="Event streams served by the custom messaging connector",
            )
        )
        for topic_name, topic_description, partitions, replication in TOPICS:
            yield Either(
                right=CreateTopicRequest(
                    name=topic_name,
                    service=service_name,
                    displayName=topic_name.replace("_", " ").title(),
                    description=topic_description,
                    partitions=partitions,
                    replicationFactor=replication,
                    retentionSize=1024.0,
                    maximumMessageSize=1048576,
                    cleanupPolicies=[CleanupPolicy.delete],
                    messageSchema=Topic(
                        schemaType=SchemaType.JSON,
                        schemaFields=[
                            FieldModel(
                                name="event_id",
                                dataType=DataTypeTopic.STRING,
                                description="Unique event identifier",
                            ),
                            FieldModel(
                                name="event_ts",
                                dataType=DataTypeTopic.LONG,
                                description="Event time in epoch millis",
                            ),
                        ],
                    ),
                )
            )
        # Sample data is attached to a persisted Topic, so the buffer must be committed first.
        yield Either(right=Barrier(reason="topics must exist before sample data"))
        for topic_name, _, _, _ in TOPICS:
            topic = self.metadata.get_by_name(entity=TopicEntity, fqn=f"{service_name}.{topic_name}")
            if topic:
                yield Either(
                    right=OMetaTopicSampleData(
                        topic=topic,
                        sample_data=TopicSampleData(messages=SAMPLE_MESSAGES),
                    )
                )
