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

import logging
import traceback
import uuid
from typing import Iterable, List

from powerbi.client import PowerBiClient
from pydantic.types import SecretStr

from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import ConfigModel, Entity, IncludeFilterPattern
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import get_dashboard_service_or_create

logger: logging.Logger = logging.getLogger(__name__)


class PowerbiSourceConfig(ConfigModel):
    """Powerbi pydantic config model"""

    client_id: str
    client_secret: SecretStr
    service_name: str
    scope: List[str] = []
    redirect_uri: str
    credentials: str
    dashboard_url: str = "https://analysis.windows.net/powerbi"
    dashboard_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()
    chart_filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()


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

    config: PowerbiSourceConfig
    metadata_config: MetadataServerConfig
    status: SourceStatus

    def __init__(
        self,
        config: PowerbiSourceConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()
        self.dashboard_service = get_dashboard_service_or_create(
            config.service_name,
            DashboardServiceType.PowerBI.name,
            config.client_id,
            config.client_secret.get_secret_value(),
            config.dashboard_url,
            metadata_config,
        )
        self.client = PowerBiClient(
            client_id=self.config.client_id,
            client_secret=self.config.client_secret.get_secret_value(),
            scope=self.config.scope,
            redirect_uri=self.config.redirect_uri,
            credentials=self.config.credentials,
        )

    @classmethod
    def create(cls, config_dict, metadata_config_dict):
        """Instantiate object

        Args:
            config_dict:
            metadata_config_dict:
        Returns:
            PowerBiSource
        """
        config = PowerbiSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
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
                if not self.config.chart_filter_pattern.included(chart["title"]):
                    self.status.failures(
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
                logger.debug(traceback.print_exc())
                logger.error(repr(err))
                self.status.failures(chart["title"], err)

    def get_dashboards(self):
        """Get dashboard method"""
        dashboard_service = self.client.dashboards()
        dashboard_list = dashboard_service.get_dashboards()
        for dashboard_id in dashboard_list.get("value"):
            try:
                dashboard_details = dashboard_service.get_dashboard(dashboard_id["id"])
                self.charts = []
                if not self.config.dashboard_filter_pattern.included(
                    dashboard_details["displayName"]
                ):
                    self.status.failures(
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
                logger.debug(traceback.print_exc())
                logger.error(err)
                self.status.failures(dashboard_details["displayName"], err)

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def prepare(self):
        pass
