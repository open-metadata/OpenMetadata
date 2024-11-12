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
"""QlikCloud source module"""

import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.qlikCloudConnection import (
    QlikCloudConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
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
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.qlikcloud.client import QlikCloudClient
from metadata.ingestion.source.dashboard.qlikcloud.models import QlikApp
from metadata.ingestion.source.dashboard.qliksense.metadata import QliksenseSource
from metadata.ingestion.source.dashboard.qliksense.models import QlikTable
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QlikcloudSource(QliksenseSource):
    """
    QlikCloud Source Class
    """

    config: WorkflowSource
    client: QlikCloudClient
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: QlikCloudConnection = config.serviceConnection.root.config
        if not isinstance(connection, QlikCloudConnection):
            raise InvalidSourceException(
                f"Expected QlikCloudConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.collections: List[QlikApp] = []
        self.data_models: List[QlikTable] = []

    def filter_draft_dashboard(self, dashboard: QlikApp) -> bool:
        # When only published(non-draft) dashboards are allowed, filter dashboard based on "published" flag from QlikApp
        return (not self.source_config.includeDraftDashboard) and (
            not dashboard.published
        )

    def get_dashboards_list(self) -> Iterable[QlikApp]:
        """
        Get List of all apps
        """
        for dashboard in self.client.get_dashboards_list():
            if self.filter_draft_dashboard(dashboard):
                # Skip unpublished dashboards
                continue
            # clean data models for next iteration
            self.data_models = []
            yield dashboard

    def get_dashboard_name(self, dashboard: QlikApp) -> str:
        """
        Get app Name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: QlikApp) -> dict:
        """
        Get app Details
        """
        return self.client.get_dashboard_details(dashboard.app_id)

    def yield_dashboard(
        self, dashboard_details: QlikApp
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_url = f"{clean_uri(self.service_connection.hostPort)}/sense/app/{dashboard_details.id}/overview"

            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                sourceUrl=SourceUrl(dashboard_url),
                displayName=dashboard_details.name,
                description=Markdown(dashboard_details.description)
                if dashboard_details.description
                else None,
                project=self.context.get().project_name,
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
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating dashboard [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def _get_database_table(
        self,
        db_service_entity: DatabaseService,
        data_model_entity: DashboardDataModel,
    ) -> Optional[Table]:
        """
        Get the table entity for lineage
        """
        # table.name in tableau can come as db.schema.table_name. Hence the logic to split it
        if data_model_entity and db_service_entity:
            try:
                schema_name, database_name = None, None
                table_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=db_service_entity.name.root,
                    schema_name=schema_name,
                    table_name=data_model_entity.displayName,
                    database_name=database_name,
                )
                if table_fqn:
                    return self.metadata.get_by_name(
                        entity=Table,
                        fqn=table_fqn,
                    )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error occured while finding table fqn: {exc}")
        return None

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: QlikApp,
        db_service_name: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method"""
        db_service_entity = self.metadata.get_by_name(
            entity=DatabaseService, fqn=db_service_name
        )
        for datamodel in self.data_models or []:
            try:
                data_model_entity = self._get_datamodel(datamodel_id=datamodel.id)
                if data_model_entity:
                    om_table = self._get_database_table(
                        db_service_entity, data_model_entity
                    )
                    if om_table:
                        columns_list = [col.name for col in datamodel.fields]
                        column_lineage = self._get_column_lineage(
                            om_table, data_model_entity, columns_list
                        )
                        yield self._get_add_lineage_request(
                            to_entity=data_model_entity,
                            from_entity=om_table,
                            column_lineage=column_lineage,
                        )
            except Exception as err:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name} Lineage",
                        error=(
                            "Error to yield dashboard lineage details for DB "
                            f"service name [{db_service_name}]: {err}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_chart(
        self, dashboard_details: QlikApp
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method"""
        charts = self.client.get_dashboard_charts(dashboard_id=dashboard_details.id)
        for chart in charts:
            try:
                chart_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/sense/app/{dashboard_details.id}"
                    f"/sheet/{chart.qInfo.qId}"
                )
                if chart.qMeta.title and filter_by_chart(
                    self.source_config.chartFilterPattern, chart.qMeta.title
                ):
                    self.status.filter(chart.qMeta.title, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(chart.qInfo.qId),
                        displayName=chart.qMeta.title,
                        description=Markdown(chart.qMeta.description)
                        if chart.qMeta.description
                        else None,
                        chartType=ChartType.Other,
                        sourceUrl=SourceUrl(chart_url),
                        service=self.context.get().dashboard_service,
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=dashboard_details.name,
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
