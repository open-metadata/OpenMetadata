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
"""Sigma source module"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
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
from metadata.ingestion.source.dashboard.sigma.models import Workbook, WorkbookDetails
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SigmaSource(DashboardServiceSource):
    """
    Sigma Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: SigmaConnection = config.serviceConnection.root.config
        if not isinstance(connection, SigmaConnection):
            raise InvalidSourceException(
                f"Expected SigmaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_dashboards_list(self) -> Optional[List[Workbook]]:
        """
        get list of dashboard
        """
        return self.client.get_dashboards()

    def get_dashboard_name(self, dashboard: Workbook) -> Optional[str]:
        """
        get dashboard name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: Workbook) -> Optional[WorkbookDetails]:
        """
        get dashboard details
        """
        return self.client.get_dashboard_detail(dashboard.workbookId)

    def yield_dashboard(
        self, dashboard_details: WorkbookDetails
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        yield Dashboard Entity
        """
        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(str(dashboard_details.workbookId)),
                displayName=dashboard_details.name,
                description=Markdown(dashboard_details.description),
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
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(dashboard_details.url),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error to yield dashboard for {dashboard_details}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: WorkbookDetails
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        yield dashboard charts
        """
        charts = self.client.get_chart_details(dashboard_details.workbookId)
        for chart in charts or []:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(str(chart.elementId)),
                        displayName=chart.name,
                        chartType=get_standard_chart_type(chart.vizualizationType),
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        sourceUrl=SourceUrl(dashboard_details.url),
                        description=Markdown(dashboard_details.description),
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=(
                            "Error to yield dashboard chart for : "
                            f"{chart.elementId} and {dashboard_details}: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self, dashboard_details: WorkbookDetails, db_service_name: Optional[str]
    ):
        """
        yield dashboard lineage
        """
        if not db_service_name:
            return
        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=str(dashboard_details.workbookId),
        )
        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )
        for chart in self.context.get().charts or []:
            nodes = self.client.get_lineage_details(dashboard_details.workbookId, chart)
            for node in nodes:
                if node.node_schema:
                    try:
                        from_fqn = fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=db_service_name,
                            schema_name=node.node_schema,
                            table_name=node.name,
                            database_name="",
                        )
                        from_entity = self.metadata.get_by_name(
                            entity=Table,
                            fqn=from_fqn,
                        )
                        if from_entity and to_entity:
                            yield self._get_add_lineage_request(
                                to_entity=to_entity, from_entity=from_entity
                            )
                    except Exception as exc:
                        yield Either(
                            left=StackTraceError(
                                name="Lineage",
                                error=(
                                    "Error to yield dashboard lineage details for DB "
                                    f"service name [{db_service_name}]: {exc}"
                                ),
                                stackTrace=traceback.format_exc(),
                            )
                        )

    def get_owner_ref(
        self, dashboard_details: WorkbookDetails
    ) -> Optional[EntityReferenceList]:
        """
        Get owner from email
        """
        try:
            if dashboard_details.ownerId:
                owner = self.client.get_owner_detail(dashboard_details.ownerId)
                return self.metadata.get_reference_by_email(owner.email)
            return None
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None
