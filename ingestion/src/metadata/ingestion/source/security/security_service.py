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
Base class for ingesting security services
"""
from abc import ABC
from typing import Set

from pydantic import Field
from typing_extensions import Annotated

from metadata.generated.schema.entity.services.securityService import (
    SecurityConnection,
    SecurityService,
)
from metadata.generated.schema.metadataIngestion.securityServiceMetadataPipeline import (
    SecurityServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import TopologyRunnerMixin
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyContextManager,
    TopologyNode,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SecurityServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Security Services.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root: Annotated[
        TopologyNode, Field(description="Root node for the topology")
    ] = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=SecurityService,
                context="security_service",
                processor="yield_create_request_security_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
        ],
        children=[],  # Security services typically don't have child entities like policies, roles, etc.
        post_process=["mark_security_entities_as_deleted"],
    )


from metadata.utils.helpers import clean_uri


class SecurityServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Security Services.
    It implements the topology and context.
    """

    source_config: SecurityServiceMetadataPipeline
    config: WorkflowSource
    # Big union of types we want to fetch dynamically
    service_connection: SecurityConnection.model_fields["config"].annotation

    topology = SecurityServiceTopology()
    context = TopologyContextManager(topology)
    security_source_state: Set = set()

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        config.serviceConnection.root.config.hostPort = clean_uri(
            config.serviceConnection.root.config.hostPort
        )
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.root.config
        self.source_config: SecurityServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )

        self.connection = get_connection(self.service_connection)
        # Flag the connection for the test connection
        self.connection_obj = self.connection
        self.client = self.get_client()
        self.test_connection()

    @property
    def name(self) -> str:
        return self.service_connection.type.name

    def close(self):
        pass

    def yield_create_request_security_service(self, config: WorkflowSource):
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=SecurityService, config=config
            )
        )

    def test_connection(self) -> None:
        self.client.test_connection()
