#  Copyright 2024 Collate
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
Base class for ingesting api services
"""
from abc import ABC, abstractmethod
from typing import Any, Iterable, Set

from pydantic import Field
from typing_extensions import Annotated

from metadata.generated.schema.api.data.createAPICollection import (
    CreateAPICollectionRequest,
)
from metadata.generated.schema.api.data.createAPIEndpoint import (
    CreateAPIEndpointRequest,
)
from metadata.generated.schema.entity.data.apiCollection import APICollection
from metadata.generated.schema.entity.data.apiEndpoint import APIEndpoint
from metadata.generated.schema.entity.services.apiService import (
    ApiConnection,
    ApiService,
)
from metadata.generated.schema.metadataIngestion.apiServiceMetadataPipeline import (
    ApiServiceMetadataPipeline,
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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ApiServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in API Services.
    service -> ApiCollection -> ApiEndpoint

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=ApiService,
                context="api_service",
                processor="yield_create_request_api_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
        ],
        children=["api_collection"],
        post_process=["mark_api_collections_as_deleted"],
    )
    api_collection: Annotated[
        TopologyNode, Field(description="API Collection Processing Node")
    ] = TopologyNode(
        producer="get_api_collections",
        stages=[
            NodeStage(
                type_=APICollection,
                context="api_collections",
                processor="yield_api_collection",
                consumer=["api_service"],
                use_cache=True,
            ),
            NodeStage(
                type_=APIEndpoint,
                context="api_endpoints",
                processor="yield_api_endpoint",
                consumer=["api_service"],
                use_cache=True,
            ),
        ],
    )


class ApiServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for API services.
    It implements the topology and context
    """

    source_config: ApiServiceMetadataPipeline
    config: WorkflowSource
    # Big union of types we want to fetch dynamically
    service_connection: ApiConnection.model_fields["config"].annotation

    topology = ApiServiceTopology()
    context = TopologyContextManager(topology)
    api_collection_source_state: Set = set()
    api_endpoint_source_state: Set = set()

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config: ApiServiceMetadataPipeline = self.config.sourceConfig.config
        self.connection = get_connection(self.service_connection)

        # Flag the connection for the test connection
        self.connection_obj = self.connection
        self.test_connection()

        self.client = self.connection

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_api_service(self, config: WorkflowSource):
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=ApiService, config=config
            )
        )

    @abstractmethod
    def get_api_collections(self, *args, **kwargs) -> Iterable[Any]:
        """
        Method to list all collections to process.
        Here is where filtering happens
        """

    @abstractmethod
    def yield_api_collection(
        self, *args, **kwargs
    ) -> Iterable[Either[CreateAPICollectionRequest]]:
        """Method to return api collection Entities"""

    @abstractmethod
    def yield_api_endpoint(
        self, *args, **kwargs
    ) -> Iterable[Either[CreateAPIEndpointRequest]]:
        """Method to return api endpoint Entities"""

    def close(self):
        """By default, nothing to close"""

    def test_connection(self) -> None:
        test_connection_common(
            self.metadata, self.connection_obj, self.service_connection
        )

    def mark_api_collections_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """Method to mark the api collection as deleted"""
        if self.source_config.markDeletedApiCollections:
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=APICollection,
                entity_source_state=self.api_collection_source_state,
                mark_deleted_entity=self.source_config.markDeletedApiCollections,
                params={"service": self.context.get().api_service},
            )

    def register_record(self, collection_request: CreateAPICollectionRequest) -> None:
        """
        Mark the api collection record as scanned and update
        the api_collection_source_state
        """
        api_collection_fqn = fqn.build(
            self.metadata,
            entity_type=APICollection,
            service_name=collection_request.service.root,
            api_collection_name=collection_request.name.root,
        )

        self.api_collection_source_state.add(api_collection_fqn)

    def prepare(self):
        """By default, nothing to prepare"""
