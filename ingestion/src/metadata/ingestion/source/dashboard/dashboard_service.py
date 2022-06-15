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
Base class for ingesting database services
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel
from sqlalchemy.engine import Inspector

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.table import Column, DataModel, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
)
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
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
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DashboardServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Dashboard Services.
    service -> dashboard -> charts.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DashboardService,
                context="dashboard_service",
                processor="yield_dashboard_service",
            )
        ],
        children=["dashboard"],
    )
    dashboard = TopologyNode(
        producer="get_dashboard",
        stages=[
            NodeStage(
                type_=Chart,
                context="dashboard_chart",
                processor="yield_dashboard_chart",
                consumer=["dashboard_service"],
                nullable=True,
            ),
            NodeStage(
                type_=Dashboard,
                context="dashboard",
                processor="yield_dashboard",
                consumer=["dashboard_service", "dashboard_chart"],
            ),
            NodeStage(
                type_=AddLineageRequest,
                context="dashboard_lineage",
                processor="yield_dashboard_chart",
                consumer=["dashboard_service", "dashboard_chart", "dashboard"],
                ack_sink=False,
                nullable=True,
                cache_all=True,
            ),
        ],
    )


@dataclass
class DashboardSourceStatus(SourceStatus):
    """
    Reports the source status after ingestion
    """

    def scanned(self, record: str) -> None:
        self.success.append(record)
        logger.info(f"Scanned: {record}")

    def filter(self, record: str, err: str) -> None:
        self.filtered.append(record)
        logger.warning(f"Filtered {record}: {err}")


class DashboardServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    @abstractmethod
    def get_dashboard(self) -> Any:
        """
        Get dashboard details
        """

    @abstractmethod
    def get_dashboard_name(self, dashboard_details: Any) -> str:
        """
        Get Dashboard Name
        """

    @abstractmethod
    def get_dashboard_details(self, dashboard: Any) -> Any:
        """
        Get Dashboard Details
        """

    status: DashboardSourceStatus
    source_config: DashboardServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: DashboardConnection.__fields__["config"].type_

    topology = DashboardServiceTopology()
    context = create_source_context(topology)

    @abstractmethod
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
        self.source_config: DashboardServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.connection = get_connection(self.service_connection)
        self.test_connection()

        self.client = self.connection.client
        self.service = self.metadata.get_service_or_create(
            entity=DashboardService, config=config
        )
        self.metadata_client = OpenMetadata(self.metadata_config)

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        test_connection(self.connection)

    def prepare(self):
        pass
