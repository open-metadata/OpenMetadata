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
"""PowerBI source module"""

import traceback
import uuid
from typing import Iterable

from powerbi.client import PowerBiClient

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.filters import filter_by_chart, filter_by_dashboard
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PowerbiSource(Source[Entity]):
    """Powerbi entity class

    Args:
        config:
        metadata_config:
    Attributes:
        config:
        metadata_config:
        status:
        dashboard_service:
        charts:
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.source_config = self.config.sourceConfig.config
        self.service_connection_config = config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)

        self.status = SourceStatus()

        self.dashboard_service = self.metadata.get_service_or_create(
            entity=DashboardService, config=config
        )

        self.client = PowerBiClient(
            client_id=self.service_connection_config.clientId,
            client_secret=self.service_connection_config.clientSecret.get_secret_value(),
            scope=self.service_connection_config.scope,
            redirect_uri=self.service_connection_config.redirectURI,
            credentials=self.service_connection_config.credentials,
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Instantiate object

        Args:
            config_dict:
            metadata_config:
        Returns:
            PowerBiSource
        """
        config = WorkflowSource.parse_obj(config_dict)
        connection: PowerBIConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PowerBIConnection):
            raise InvalidSourceException(
                f"Expected PowerBIConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[Entity]:
        yield from self.get_dashboards()

    def get_charts(self, charts) -> Iterable[Chart]:
        """Get chart method
        Args:
            charts:
        Returns:
            Iterable[Chart]
        """
        for chart in charts:
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["title"]
                ):
                    self.status.failure(
                        chart["title"], "Filtered out using Chart filter pattern"
                    )
                    continue
                yield Chart(
                    id=uuid.uuid4(),
                    name=chart["id"],
                    displayName=chart["title"],
                    description="",
                    chart_type="",
                    url=chart["embedUrl"],
                    service=EntityReference(
                        id=self.dashboard_service.id, type="dashboardService"
                    ),
                )
                self.charts.append(chart["id"])
                self.status.scanned(chart["title"])
            except Exception as err:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.error(repr(err))
                self.status.failure(chart["title"], repr(err))

    def get_dashboards(self):
        """Get dashboard method"""
        dashboard_service = self.client.dashboards()
        dashboard_list = dashboard_service.get_dashboards()
        for dashboard_id in dashboard_list.get("value"):
            try:
                dashboard_details = dashboard_service.get_dashboard(dashboard_id["id"])
                self.charts = []
                if filter_by_dashboard(
                    self.source_config.dashboardFilterPattern,
                    dashboard_details["displayName"],
                ):
                    self.status.failure(
                        dashboard_details["displayName"],
                        "Filtered out using Chart filter pattern",
                    )
                    continue
                yield from self.get_charts(
                    dashboard_service.get_tiles(
                        dashboard_id=dashboard_details["id"]
                    ).get("value")
                )
                yield Dashboard(
                    name=dashboard_details["id"],
                    url=dashboard_details["webUrl"],
                    displayName=dashboard_details["displayName"],
                    description="",
                    charts=self.charts,
                    service=EntityReference(
                        id=self.dashboard_service.id, type="dashboardService"
                    ),
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)
                self.status.failure(dashboard_details["displayName"], repr(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def prepare(self):
        pass

    def test_connection(self) -> None:
        pass
