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
DomoDashboard source to extract metadata
"""

import traceback
from typing import Any, Iterable, List, Optional

from pydantic import ValidationError

from metadata.clients.domo_client import (
    DomoChartDetails,
    DomoDashboardDetails,
    DomoOwner,
)
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.dashboard.domoDashboardConnection import (
    DomoDashboardConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
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
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: DomoDashboardConnection = config.serviceConnection.root.config
        if not isinstance(connection, DomoDashboardConnection):
            raise InvalidSourceException(
                f"Expected DomoDashboardConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboards_list(self) -> Optional[List[DomoDashboardDetails]]:
        dashboards = self.client.domo.page_list()
        dashboard_list = []
        for dashboard in dashboards:
            dashboard_detail = self.get_page_details(page_id=dashboard["id"])
            dashboard_list.append(
                DomoDashboardDetails(
                    id=dashboard_detail.id,
                    name=dashboard_detail.name,
                    cardIds=dashboard_detail.cardIds,
                    description=dashboard_detail.description,
                    owners=dashboard_detail.owners,
                    collectionIds=dashboard_detail.collectionIds,
                )
            )
        return dashboard_list

    def get_dashboard_name(self, dashboard: DomoDashboardDetails) -> str:
        return dashboard.name

    def get_dashboard_details(self, dashboard: DomoDashboardDetails) -> dict:
        return dashboard

    def get_owner_ref(
        self, dashboard_details: DomoDashboardDetails
    ) -> Optional[EntityReferenceList]:
        for owner in dashboard_details.owners or []:
            try:
                owner_details = self.client.domo.users_get(owner.id)
                if owner_details.get("email"):
                    return self.metadata.get_reference_by_email(owner_details["email"])
            except Exception as exc:
                logger.warning(
                    f"Error while getting details of user {owner.displayName} - {exc}"
                )
        return None

    def yield_dashboard(
        self, dashboard_details: DomoDashboardDetails
    ) -> Iterable[Either[CreateDashboardRequest]]:
        try:
            dashboard_url = (
                f"{self.service_connection.instanceDomain}page/{dashboard_details.id}"
            )

            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                sourceUrl=SourceUrl(dashboard_url),
                displayName=dashboard_details.name,
                description=Markdown(dashboard_details.description)
                if dashboard_details.description
                else None,
                charts=[
                    FullyQualifiedEntityName(
                        fqn.build(
                            self.metadata,
                            entity_type=Chart,
                            service_name=self.context.get().dashboard_service,
                            chart_name=chart,
                        )
                    )
                    for chart in self.context.get().charts or []
                ],
                service=self.context.get().dashboard_service,
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except KeyError as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error extracting data from {dashboard_details.name} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )
        except ValidationError as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error building pydantic model for {dashboard_details.name} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as err:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Wild error ingesting dashboard {dashboard_details.name} - {err}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def get_owners(self, owners: List[dict]) -> List[DomoOwner]:
        domo_owner = []
        for owner in owners:
            domo_owner.append(
                DomoOwner(id=str(owner["id"]), displayName=owner["displayName"])
            )

        return domo_owner

    def get_page_details(self, page_id) -> Optional[DomoDashboardDetails]:
        try:
            pages = self.client.domo.page_get(page_id)
            return DomoDashboardDetails(
                name=pages["name"],
                id=str(pages["id"]),
                cardIds=pages.get("cardIds", []),
                description=pages.get("description", ""),
                collectionIds=pages.get("collectionIds", []),
                owners=self.get_owners(pages.get("owners", [])),
            )
        except Exception as exc:
            logger.warning(
                f"Error while getting details from collection page {page_id} - {exc}"
            )
            logger.debug(traceback.format_exc())
            return None

    def get_chart_ids(self, collection_ids: List[Any]):
        chart_ids = []
        for collection_id in collection_ids or []:
            chart_id = self.get_page_details(page_id=collection_id)
            for chart in chart_id.cardIds:
                chart_ids.append(chart)
        return chart_ids

    def yield_dashboard_chart(
        self, dashboard_details: DomoDashboardDetails
    ) -> Iterable[Either[CreateChartRequest]]:
        chart_ids = dashboard_details.cardIds
        chart_id_from_collection = self.get_chart_ids(dashboard_details.collectionIds)
        chart_ids.extend(chart_id_from_collection)
        for chart_id in chart_ids:
            chart: Optional[DomoChartDetails] = None
            try:
                chart = self.client.custom.get_chart_details(page_id=chart_id)
                chart_url = (
                    f"{self.service_connection.instanceDomain}page/"
                    f"{dashboard_details.id}/kpis/details/{chart_id}"
                )

                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                if chart.name:
                    yield Either(
                        right=CreateChartRequest(
                            name=EntityName(str(chart_id)),
                            description=Markdown(chart.description)
                            if chart.description
                            else None,
                            displayName=chart.name,
                            sourceUrl=SourceUrl(chart_url),
                            service=self.context.get().dashboard_service,
                            chartType=get_standard_chart_type(chart.metadata.chartType),
                        )
                    )
            except Exception as exc:
                name = chart.name if chart else ""
                yield Either(
                    left=StackTraceError(
                        name=name,
                        error=f"Error creating chart [{name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: dict,
        db_service_name: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """No lineage implemented"""
