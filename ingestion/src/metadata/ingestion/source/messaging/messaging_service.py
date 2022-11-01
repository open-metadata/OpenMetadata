#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Base class for ingesting messaging services
"""

from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.messagingService import (
    MessagingConnection,
    MessagingService,
)
from metadata.generated.schema.metadataIngestion.messagingServiceMetadataPipeline import (
    MessagingServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.connections import get_connection, test_connection
from metadata.utils.filters import filter_by_topic


class MessagingServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Messaging Services.
    service -> messaging -> topics.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=MessagingService,
                context="messaging_service",
                processor="yield_create_request_messaging_service",
                overwrite=False,
                must_return=True,
            )
        ],
        children=["topic"],
    )
    topic = TopologyNode(
        producer="get_topic",
        stages=[
            NodeStage(
                type_=Topic,
                context="Topic",
                processor="yield_topic",
                consumer=["messaging_service"],
            )
        ],
    )


class MessagingSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    topics_scanned: List[str] = []
    filtered: List[str] = []

    def topic_scanned(self, topic: str) -> None:
        self.topics_scanned.append(topic)

    def dropped(self, topic: str) -> None:
        self.filtered.append(topic)


class MessagingServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Messaging Services.
    It implements the topology and context.
    """

    @abstractmethod
    def yield_topic(self, topic_details: Any) -> Iterable[CreateTopicRequest]:
        """
        Method to Get Messaging Entity
        """

    @abstractmethod
    def get_topic_list(self) -> Optional[List[Any]]:
        """
        Get List of all topics
        """

    @abstractmethod
    def get_topic_name(self, topic_details: Any) -> str:
        """
        Get Topic Name
        """

    status: MessagingSourceStatus
    source_config: MessagingServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: MessagingConnection.__fields__["config"].type_

    topology = MessagingServiceTopology()
    context = create_source_context(topology)

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.source_config: MessagingServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.service_connection = self.config.serviceConnection.__root__.config
        self.connection = get_connection(self.service_connection)
        self.test_connection()
        self.status = MessagingSourceStatus()

    def get_topic(self) -> Any:
        for topic_details in self.get_topic_list():
            topic_name = self.get_topic_name(topic_details)
            if filter_by_topic(
                self.source_config.topicFilterPattern,
                topic_name,
            ):
                self.status.filter(
                    topic_name,
                    "Topic Filtered Out",
                )
                continue
            yield topic_details

    def yield_create_request_messaging_service(self, config: WorkflowSource):
        yield self.metadata.get_create_service_from_source(
            entity=MessagingService, config=config
        )

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def prepare(self):
        pass

    def get_status(self):
        return self.status

    def test_connection(self) -> None:
        test_connection(self.connection)

    def close(self):
        pass
