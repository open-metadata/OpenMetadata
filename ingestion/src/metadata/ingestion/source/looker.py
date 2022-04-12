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

import logging
import os
import traceback
from typing import Iterable

import looker_sdk

from metadata.generated.schema.entity.services.connections.dashboard import (
    lookerConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException, Source, SourceStatus
from metadata.ingestion.models.table_metadata import Chart, Dashboard
from metadata.utils.filters import filter_by_chart, filter_by_dashboard
from metadata.utils.helpers import get_dashboard_service_or_create

logger = logging.getLogger(__name__)


class LookerSource(Source[Entity]):
    config: WorkflowSource
    metadata_config: OpenMetadataServerConfig

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataServerConfig,
    ):
        super().__init__()
        self.config = config
        self.source_config = config.sourceConfig.config
        self.service_connection = config.serviceConnection.__root__.config
        self.metadata_config = metadata_config
        self.client = self.looker_client()
        self.status = SourceStatus()
        self.service = get_dashboard_service_or_create(
            service_name=config.serviceName,
            dashboard_service_type=DashboardServiceType.Looker.name,
            config=self.service_connection.dict(),
            metadata_config=metadata_config,
        )

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
    def create(cls, config_dict: dict, metadata_config: OpenMetadataServerConfig):
        config = WorkflowSource.parse_obj(config_dict)
        connection: lookerConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, lookerConnection):
            raise InvalidSourceException(
                f"Expected LookerConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        pass

    def next_record(self) -> Iterable[Entity]:
        yield from self._get_looker_dashboards()

    def _get_dashboard_elements(self, dashboard_elements):
        if not filter_by_chart(
            chart_filter_pattern=self.source_config.chartFilterPattern,
            chart_name=dashboard_elements.id,
        ):
            self.status.failures(dashboard_elements.id)
            return None
        om_dashboard_elements = Chart(
            name=dashboard_elements.id,
            displayName=dashboard_elements.title or "",
            description="",
            chart_type=dashboard_elements.type,
            url=f"{self.service_connection.hostPort}/dashboard_elements/{dashboard_elements.id}",
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )
        if not dashboard_elements.id:
            raise ValueError("Chart(Dashboard Element) without ID")
        self.status.scanned(dashboard_elements.id)
        yield om_dashboard_elements
        self.charts.append(om_dashboard_elements)
        self.chart_names.append(dashboard_elements.id)

    def _get_looker_dashboards(self):
        all_dashboards = self.client.all_dashboards(fields="id")
        for child_dashboard in all_dashboards:
            try:
                if not filter_by_dashboard(
                    dashboard_filter_pattern=self.source_config.dashboardFilterPattern,
                    dashboard_name=child_dashboard.id,
                ):
                    self.status.failures(child_dashboard.id)
                    continue
                fields = [
                    "id",
                    "title",
                    "dashboard_elements",
                    "dashboard_filters",
                    "view_count",
                ]
                dashboard = self.client.dashboard(
                    dashboard_id=child_dashboard.id, fields=",".join(fields)
                )
                self.charts = []
                self.chart_names = []
                for iter_chart in dashboard.dashboard_elements:
                    try:
                        yield from self._get_dashboard_elements(iter_chart)
                    except Exception as err:
                        logger.debug(traceback.print_exc())
                        logger.error(err)
                yield Dashboard(
                    name=dashboard.id,
                    displayName=dashboard.title,
                    description=dashboard.description or "",
                    charts=self.chart_names,
                    url=f"{self.service_connection.hostPort}/dashboards/{dashboard.id}",
                    service=EntityReference(
                        id=self.service.id, type="dashboardService"
                    ),
                )
                self.status.failures(child_dashboard.id)
            except Exception as err:
                logger.error(repr(err))

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        pass
