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
Base class for ingesting messaging services
"""

from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional, Set

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from metadata.generated.schema.api.data.createTopic import CreateTopicRequest
from metadata.generated.schema.entity.data.topic import Topic, TopicSampleData
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
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, test_connection_common
from metadata.utils import fqn
from metadata.utils.filters import filter_by_topic
from metadata.utils.helpers import retry_with_docker_host
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

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=MessagingService,
                context="messaging_service",
                processor="yield_create_request_messaging_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            )
        ],
        children=["topic"],
        post_process=["mark_topics_as_deleted"],
    )
    topic: Annotated[
        TopologyNode, Field(description="Topic Processing Node")
    ] = TopologyNode(
        producer="get_topic",
        stages=[
            NodeStage(
                type_=Topic,
                context="topic",
                processor="yield_topic",
                consumer=["messaging_service"],
                use_cache=True,
            ),
            NodeStage(
                type_=TopicSampleData,
                processor="yield_topic_sample_data",
                consumer=["messaging_service"],
                nullable=True,
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
    service_connection: MessagingConnection.model_fields["config"].annotation

    topology = MessagingServiceTopology()
    context = TopologyContextManager(topology)
    topic_source_state: Set = set()

    @retry_with_docker_host()
    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.source_config: MessagingServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.service_connection = self.config.serviceConnection.root.config
        self.connection = get_connection(self.service_connection)

        # Flag the connection for the test connection
        self.connection_obj = self.connection
        self.test_connection()

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    @abstractmethod
    def yield_topic(self, topic_details: Any) -> Iterable[Either[CreateTopicRequest]]:
        """
        Method to Get Messaging Entity
        """

    def yield_topic_sample_data(
        self, topic_details: Any
    ) -> Iterable[Either[TopicSampleData]]:
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
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=MessagingService, config=config
            )
        )

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def prepare(self):
        """By default, nothing to prepare"""

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )

    def mark_topics_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Method to mark the topics as deleted"""
        if self.source_config.markDeletedTopics:
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Topic,
                entity_source_state=self.topic_source_state,
                mark_deleted_entity=self.source_config.markDeletedTopics,
                params={"service": self.context.get().messaging_service},
            )

    def register_record(self, topic_request: CreateTopicRequest) -> None:
        """
        Mark the topic record as scanned and update the topic_source_state
        """
        topic_fqn = fqn.build(
            self.metadata,
            entity_type=Topic,
            service_name=topic_request.service.root,
            topic_name=topic_request.name.root,
        )

        self.topic_source_state.add(topic_fqn)

    def close(self):
        """By default, nothing to close"""
