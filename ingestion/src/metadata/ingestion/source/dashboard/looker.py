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

import os
import traceback
from typing import Any, Iterable, List, Optional

import looker_sdk

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.utils.filters import filter_by_chart, filter_by_dashboard
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LookerSource(DashboardSourceService):
    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.client = self.looker_client()

    def check_env(self, env_key):
        if os.environ.get(env_key):
            return True
        return None

    def looker_client(self):
        try:
            if not self.check_env("LOOKERSDK_CLIENT_ID"):
                os.environ["LOOKERSDK_CLIENT_ID"] = self.service_connection.username
            if not self.check_env("LOOKERSDK_CLIENT_SECRET"):
                os.environ[
                    "LOOKERSDK_CLIENT_SECRET"
                ] = self.service_connection.password.get_secret_value()
            if not self.check_env("LOOKERSDK_BASE_URL"):
                os.environ["LOOKERSDK_BASE_URL"] = self.service_connection.hostPort
            client = looker_sdk.init31()
            client.me()
            return client
        except Exception as err:
            logger.error(f"ERROR: {repr(err)}")

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: LookerConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, LookerConnection):
            raise InvalidSourceException(
                f"Expected LookerConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[Any]]:
        """
        Get List of all dashboards
        """
        return self.client.all_dashboards(fields="id")

    def get_dashboard_name(self, dashboard_details: object) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details.id

    def get_dashboard_details(self, dashboard: object) -> dict:
        """
        Get Dashboard Details
        """
        fields = [
            "id",
            "title",
            "dashboard_elements",
            "dashboard_filters",
            "view_count",
        ]
        return self.client.dashboard(dashboard_id=dashboard.id, fields=",".join(fields))

    def get_dashboard_entity(self, dashboard_details) -> Dashboard:
        """
        Method to Get Dashboard Entity
        """
        yield from self.fetch_dashboard_charts(dashboard_details)
        yield Dashboard(
            name=dashboard_details.id,
            displayName=dashboard_details.title,
            description=dashboard_details.description or "",
            charts=self.chart_names,
            url=f"/dashboards/{dashboard_details.id}",
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    def get_lineage(self, dashboard_details) -> Optional[AddLineageRequest]:
        """
        Get lineage between dashboard and data sources
        """
        logger.info("Lineage not implemented for Looker")
        return None

    def fetch_dashboard_charts(self, dashboard_details) -> Optional[Iterable[Chart]]:
        """
        Metod to fetch charts linked to dashboard
        """
        self.charts = []
        self.chart_names = []
        for dashboard_elements in dashboard_details.dashboard_elements:
            try:
                if filter_by_chart(
                    chart_filter_pattern=self.source_config.chartFilterPattern,
                    chart_name=dashboard_elements.id,
                ):
                    self.status.filter(dashboard_elements.id, "Chart filtered out")
                    continue
                om_dashboard_elements = Chart(
                    name=dashboard_elements.id,
                    displayName=dashboard_elements.title or "",
                    description="",
                    chart_type=dashboard_elements.type,
                    url=f"/dashboard_elements/{dashboard_elements.id}",
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                )
                if not dashboard_elements.id:
                    raise ValueError("Chart(Dashboard Element) without ID")
                self.status.scanned(dashboard_elements.id)
                yield om_dashboard_elements
                self.charts.append(om_dashboard_elements)
                self.chart_names.append(dashboard_elements.id)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)
