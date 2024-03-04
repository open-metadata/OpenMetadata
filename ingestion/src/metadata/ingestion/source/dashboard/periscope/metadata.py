import csv
import json
import traceback
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LineageParser
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)

from pydantic import BaseModel, ValidationError, validator
from pathlib import Path
from typing import Iterable, Optional, List, Dict, Any

from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either, StackTraceError
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel, DataModelType
from metadata.generated.schema.api.data.createDashboardDataModel import CreateDashboardDataModelRequest
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import (
    clean_uri,
    get_standard_chart_type,
    replace_special_with,
)
from metadata.utils import fqn
from metadata.generated.schema.entity.services.dashboardService import DashboardServiceType
from metadata.generated.schema.entity.services.connections.dashboard.customDashboardConnection import (
    CustomDashboardConnection,
)
from metadata.ingestion.source.dashboard.periscope.connection import PeriscopeConnection
from metadata.ingestion.source.dashboard.periscope.models import PeriscopeDashboard, PeriscopeChart, PeriscopeView, PeriscopeDashboardDetails

logger = ingestion_logger()


class PeriscopeSource(DashboardServiceSource):
    """
    Periscope Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config = WorkflowSource.parse_obj(config_dict)
        connection: PeriscopeConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PeriscopeConnection):
            raise InvalidSourceException(
                f"Expected PeriscopeConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.views: List[PeriscopeView] = []

    def prepare(self):
        self.collections = self.client.get()
        return super().prepare()

    def get_dashboards_list(self) -> Optional[List[PeriscopeDashboard]]:
        """
        Get List of all dashboards
        """
        return self.client.get_dashboards_list()

    def get_dashboard_name(self, dashboard: PeriscopeDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: PeriscopeDashboard) -> dict:
        """
        Get Dashboard Details
        """
        return self.client.get_dashboard_details(dashboard.id)

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:
        """
        Method to get the project name by searching the dataset using id in the workspace dict
        """
        try:
            if dashboard_details.collection_id:
                collection_name = next(
                    (
                        collection.name
                        for collection in self.collections
                        if collection.id == dashboard_details.collection_id
                    ),
                    None,
                )
                return collection_name
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching the collection details for [{dashboard_details.collection_id}]: {exc}"
            )
        return None

    def yield_dashboard(
        self, dashboard_details: PeriscopeDashboardDetails
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_url = (
                f"https://app.periscopedata.com/app/gorgias/{dashboard_details.dashboard.id}/"
                f"{replace_special_with(raw=dashboard_details.dashboard.name.lower(), replacement='-')}"
            )
            dashboard_request = CreateDashboardRequest(
                name=dashboard_details.dashboard.name,
                sourceUrl=dashboard_url,
                displayName=dashboard_details.dashboard.name,
                description=dashboard_details.dashboard.description,
                project=self.context.project_name,
                charts=[
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.dashboard_service,
                        chart_name=chart,
                    )
                    for chart in self.context.charts or []
                ],
                service=self.context.dashboard_service,
                owner=self.get_owner_ref(dashboard_details=dashboard_details),
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

    def yield_dashboard_chart(
        self, dashboard_details: PeriscopeDashboardDetails
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        charts = dashboard_details.ordered_cards
        for chart in charts:
            try:
                chart_details = chart.card
                if not chart_details.id or not chart_details.name:
                    continue
                chart_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/question/{chart_details.id}-"
                    f"{replace_special_with(raw=chart_details.name.lower(), replacement='-')}"
                )
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_details.name
                ):
                    self.status.filter(chart_details.name, "Chart Pattern not allowed")
                    continue
                yield Either(
                    right=CreateChartRequest(
                        name=chart_details.id,
                        displayName=chart_details.name,
                        description=chart_details.description,
                        chartType=get_standard_chart_type(chart_details.display).value,
                        sourceUrl=chart_url,
                        service=self.context.dashboard_service,
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error creating chart [{chart}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: PeriscopeDashboardDetails,
        db_service_name: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method

        Args:
            dashboard_details
        """
        if not db_service_name:
            return
        chart_list, dashboard_name = (
            dashboard_details.ordered_cards,
            str(dashboard_details.id),
        )
        for chart in chart_list:
            try:
                chart_details = chart.card
                if (
                    chart_details.dataset_query is None
                    or chart_details.dataset_query.type is None
                ):
                    continue
                if chart_details.dataset_query.type == "native":
                    yield from self._yield_lineage_from_query(
                        chart_details=chart_details,
                        db_service_name=db_service_name,
                        dashboard_name=dashboard_name,
                    ) or []

                # TODO: this method below only gets a single table, but if the chart of type query has a join the other
                # table_ids will be ignored within a nested object
                elif chart_details.dataset_query.type == "query":
                    if not chart_details.table_id:
                        continue
                    yield from self._yield_lineage_from_api(
                        chart_details=chart_details,
                        db_service_name=db_service_name,
                        dashboard_name=dashboard_name,
                    ) or []

            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=f"Error adding lineage: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _get_database_service(self, db_service_name: str):
        return self.metadata.get_by_name(DatabaseService, db_service_name)

    def _yield_lineage_from_query(
        self, chart_details: PeriscopeChart, db_service_name: str, dashboard_name: str
    ) -> Iterable[Either[AddLineageRequest]]:
        database = self.client.get_database(chart_details.database_id)

        query = None
        if (
            chart_details.dataset_query
            and chart_details.dataset_query.native
            and chart_details.dataset_query.native.query
        ):
            query = chart_details.dataset_query.native.query

        if query is None:
            return

        database_name = database.details.db if database and database.details else None

        db_service = self._get_database_service(db_service_name)

        lineage_parser = LineageParser(
            query,
            ConnectionTypeDialectMapper.dialect_of(db_service.serviceType.value)
            if db_service
            else None,
        )

        for table in lineage_parser.source_tables:
            database_schema_name, table = fqn.split(str(table))[-2:]
            database_schema_name = self.check_database_schema_name(database_schema_name)
            from_entities = search_table_entities(
                metadata=self.metadata,
                database=database_name,
                service_name=db_service_name,
                database_schema=database_schema_name,
                table=table,
            )

            to_fqn = fqn.build(
                self.metadata,
                entity_type=LineageDashboard,
                service_name=self.config.serviceName,
                dashboard_name=dashboard_name,
            )
            to_entity = self.metadata.get_by_name(
                entity=LineageDashboard,
                fqn=to_fqn,
            )

            for from_entity in from_entities:
                yield self._get_add_lineage_request(
                    to_entity=to_entity, from_entity=from_entity
                )

    def _yield_lineage_from_api(
        self, chart_details: PeriscopeChart, db_service_name: str, dashboard_name: str
    ) -> Iterable[Either[AddLineageRequest]]:
        table = self.client.get_table(chart_details.table_id)
        table_name = table.name or table.display_name

        if table is None or table_name is None:
            return

        database_name = table.db.details.db if table.db and table.db.details else None
        from_entities = search_table_entities(
            metadata=self.metadata,
            database=database_name,
            service_name=db_service_name,
            database_schema=table.table_schema,
            table=table_name,
        )

        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_name,
        )

        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )

        for from_entity in from_entities:
            yield self._get_add_lineage_request(
                to_entity=to_entity, from_entity=from_entity
            )
