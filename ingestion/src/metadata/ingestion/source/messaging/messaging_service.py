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
from typing import Any, Iterable, List, Optional, Set

from pydantic import BaseModel

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import Topic, TopicSampleData
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
from metadata.ingestion.api.source import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.delete_entity import (
    DeleteEntity,
    delete_entity_from_source,
)
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils import fqn
from metadata.utils.filters import filter_by_topic
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class BrokerTopicDetails(BaseModel):
    """
    Wrapper Class to combine the topic_name with topic_metadata
    """

    topic_name: str
    topic_metadata: Any


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
        post_process=["mark_topics_as_deleted"],
    )
    topic = TopologyNode(
        producer="get_topic",
        stages=[
            NodeStage(
                type_=Topic,
                context="topic",
                processor="yield_topic",
                consumer=["messaging_service"],
            ),
            NodeStage(
                type_=TopicSampleData,
                context="topic_sample_data",
                processor="yield_topic_sample_data",
                consumer=["messaging_service"],
                nullable=True,
                ack_sink=False,
            ),
        ],
    )


class MessagingServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Messaging Services.
    It implements the topology and context.
    """

    source_config: MessagingServiceMetadataPipeline
    config: WorkflowSource
    # Big union of types we want to fetch dynamically
    service_connection: MessagingConnection.__fields__["config"].type_

    topology = MessagingServiceTopology()
    context = create_source_context(topology)
    topic_source_state: Set = set()

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

        # Flag the connection for the test connection
        self.connection_obj = self.connection
        self.test_connection()

    @abstractmethod
    def yield_topic(self, topic_details: Any) -> Iterable[CreateTopicRequest]:
        """
        Method to Get Messaging Entity
        """

    def yield_topic_sample_data(self, topic_details: Any) -> Iterable[TopicSampleData]:
        """
        Method to Get Sample Data of Messaging Entity
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

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.connection_obj, self.service_connection)

    def mark_topics_as_deleted(self) -> Iterable[DeleteEntity]:
        """
        Method to mark the topics as deleted
        """
        if self.source_config.markDeletedTopics:
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Topic,
                entity_source_state=self.topic_source_state,
                mark_deleted_entity=self.source_config.markDeletedTopics,
                params={
                    "service": self.context.messaging_service.fullyQualifiedName.__root__
                },
            )

    def register_record(self, topic_request: CreateTopicRequest) -> None:
        """
        Mark the topic record as scanned and update the topic_source_state
        """
        topic_fqn = fqn.build(
            self.metadata,
            entity_type=Topic,
            service_name=topic_request.service.__root__,
            topic_name=topic_request.name.__root__,
        )

        self.topic_source_state.add(topic_fqn)
        self.status.scanned(topic_request.name.__root__)

    def close(self):
        pass
