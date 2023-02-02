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
DomoDashboard source to extract metadata
"""

import traceback
from typing import Any, Iterable, List, Optional

from pydantic import ValidationError

from metadata.clients.domo_client import DomoClient
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.services.connections.dashboard.domoDashboardConnection import (
    DomoDashboardConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DomodashboardSource(DashboardServiceSource):
    """
    Implements the necessary methods to extract
    Dashboard metadata from Domo's metadata db
    """

    config: WorkflowSource
    metadata: OpenMetadataConnection
    status: SourceStatus

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.domo_client = DomoClient(self.service_connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: DomoDashboardConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DomoDashboardConnection):
            raise InvalidSourceException(
                f"Expected MetabaseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[dict]]:
        dashboards = self.client.page_list()
        dashboard_list = []
        for dashboard in dashboards:
            dashboard_detail = self.get_page_details(page_id=dashboard["id"])
            dashboard_list.append(dashboard_detail)
        return dashboard_list

    def get_dashboard_name(self, dashboard: Any) -> str:
        return dashboard["name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        return dashboard

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        try:
            dashboard_url = f"{self.service_connection.sandboxDomain}/page/{dashboard_details['id']}"

            yield CreateDashboardRequest(
                name=dashboard_details["id"],
                dashboardUrl=dashboard_url,
                displayName=dashboard_details.get("name"),
                description=dashboard_details.get("description", ""),
                charts=[
                    EntityReference(id=chart.id.__root__, type="chart")
                    for chart in self.context.charts
                ],
                service=EntityReference(
                    id=self.context.dashboard_service.id.__root__,
                    type="dashboardService",
                ),
            )
        except KeyError as err:
            logger.warning(
                f"Error extracting data from {dashboard_details.get('name', 'unknown')} - {err}"
            )
            logger.debug(traceback.format_exc())
        except ValidationError as err:
            logger.warning(
                f"Error building pydantic model for {dashboard_details.get('name', 'unknown')} - {err}"
            )
            logger.debug(traceback.format_exc())
        except Exception as err:
            logger.warning(
                f"Wild error ingesting dashboard {dashboard_details.get('name', 'unknown')} - {err}"
            )
            logger.debug(traceback.format_exc())

    def get_page_details(self, page_id):
        try:
            pages = self.client.page_get(page_id)
            return pages
        except Exception as exc:
            logger.warning(
                f"Error while getting details from collection {page_id} - {exc}"
            )
            logger.debug(traceback.format_exc())
            return None

    def get_chart_ids(self, collection_ids: List[Any]):
        chart_ids = []
        for collection_id in collection_ids:
            chart_id = self.get_page_details(page_id=collection_id)
            for chart in chart_id.get("cardIds", []):
                chart_ids.append(chart)
        return chart_ids

    def yield_dashboard_chart(
        self, dashboard_details: Any
    ) -> Optional[Iterable[CreateChartRequest]]:
        chart_ids = dashboard_details["cardIds"]
        chart_id_from_collection = self.get_chart_ids(
            dashboard_details.get("collectionIds", [])
        )
        chart_ids.extend(chart_id_from_collection)
        for chart_id in chart_ids:
            try:
                chart = self.domo_client.get_chart_details(page_id=chart_id)

                chart_url = (
                    f"{self.service_connection.sandboxDomain}/page/"
                    f"{dashboard_details['id']}/kpis/details/{chart_id}"
                )

                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["title"]
                ):
                    self.status.filter(chart["title"], "Chart Pattern not allowed")
                    continue

                yield CreateChartRequest(
                    name=chart_id,
                    description=chart.get("description", ""),
                    displayName=chart.get("title"),
                    chartType=get_standard_chart_type(
                        chart["metadata"].get("chartType", "")
                    ).value,
                    chartUrl=chart_url,
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart["title"])
            except Exception as exc:
                logger.warning(f"Error creating chart [{chart}]: {exc}")
                logger.debug(traceback.format_exc())
                continue

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name
    ) -> Optional[Iterable[AddLineageRequest]]:
        return
