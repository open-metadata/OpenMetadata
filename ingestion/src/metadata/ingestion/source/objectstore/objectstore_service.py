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
Base class for ingesting Object Storage services
"""
from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional

from metadata.ingestion.source.objectstore.s3.connection import S3ObjectStoreClient

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.api.data.createContainer import CreateContainerRequest
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.objectstoreService import (
    ObjectStoreConnection,
    ObjectStoreService,
)
from metadata.generated.schema.metadataIngestion.objectstoreServiceMetadataPipeline import (
    ObjectStoreServiceMetadataPipeline,
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
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ObjectStoreServiceTopology(ServiceTopology):

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=ObjectStoreService,
                context="objectstore_service",
                processor="yield_create_request_objectstore_service",
                overwrite=False,
                must_return=True,
            ),
        ],
        children=["container"],
    )

    container = TopologyNode(
        producer="get_containers",
        stages=[
            NodeStage(
                type_=Container,
                context="containers",
                processor="yield_create_container_requests",
                consumer=["objectstore_service"],
                nullable=True,
            )
        ],
    )


class ObjectStoreSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.debug(f"Scanned: {record}")

    def filter(self, key: str, reason: str) -> None:
        self.filtered.append(key)
        logger.debug(f"Filtered {key}: {reason}")


class ObjectStoreServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Object Store Services.
    It implements the topology and context.
    """

    status: ObjectStoreSourceStatus
    source_config: ObjectStoreServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: ObjectStoreConnection.__fields__["config"].type_

    topology = ObjectStoreServiceTopology()
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
        self.service_connection = self.config.serviceConnection.__root__.config
        self.source_config: ObjectStoreServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.connection: S3ObjectStoreClient = get_connection(self.service_connection)
        self.test_connection()
        self.status = ObjectStoreSourceStatus()

    @abstractmethod
    def get_containers(self) -> Iterable[Any]:
        """
        Retrieve all containers for the service
        """

    @abstractmethod
    def yield_create_container_requests(
        self, container_details: Any
    ) -> Iterable[CreateContainerRequest]:
        """ Generate the create container requests based on the received details"""

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def prepare(self):
        pass

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.connection)

    def yield_create_request_objectstore_service(self, config: WorkflowSource):
        yield self.metadata.get_create_service_from_source(
            entity=ObjectStoreService, config=config
        )
