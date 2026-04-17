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
SSRS source module
"""
import traceback
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart, ChartType
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.ssrsConnection import (
    SsrsConnection,
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
    SqlQuery,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.ssrs.models import SsrsReport
from metadata.ingestion.source.dashboard.ssrs.rdl_parser import (
    SsrsDataSet,
    SsrsDataSource,
    SsrsReportDefinition,
    parse_rdl,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri, get_database_name_for_lineage
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

SKIP_COMMAND_TYPES = {"StoredProcedure", "Expression"}
MDX_PROVIDERS = {"OLEDB-MD", "ADOMD", "SAPBW"}

DATA_PROVIDER_DIALECT = {
    "SQL": Dialect.TSQL,
    "ORACLE": Dialect.ORACLE,
    "MYSQL": Dialect.MYSQL,
    "POSTGRESQL": Dialect.POSTGRES,
    "PGSQL": Dialect.POSTGRES,
    "DB2": Dialect.DB2,
    "SNOWFLAKE": Dialect.SNOWFLAKE,
    "REDSHIFT": Dialect.REDSHIFT,
    "BIGQUERY": Dialect.BIGQUERY,
    "TERADATA": Dialect.TERADATA,
    "HIVE": Dialect.HIVE,
    "CLICKHOUSE": Dialect.CLICKHOUSE,
    "DATABRICKS": Dialect.DATABRICKS,
    "VERTICA": Dialect.VERTICA,
    "TRINO": Dialect.TRINO,
    "SPARK": Dialect.SPARKSQL,
    "SPARKSQL": Dialect.SPARKSQL,
    "ATHENA": Dialect.ATHENA,
    "IMPALA": Dialect.IMPALA,
    "MARIADB": Dialect.MARIADB,
    "SQLITE": Dialect.SQLITE,
}


@dataclass(frozen=True)
class _LineageContext:
    db_service_name: Optional[str]
    db_service_entity: Optional[DatabaseService]
    prefix_database: Optional[str]
    prefix_schema: Optional[str]
    dialect: Dialect


class SsrsSource(DashboardServiceSource):
    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "SsrsSource":
        config = WorkflowSource.model_validate(config_dict)
        connection: SsrsConnection = config.serviceConnection.root.config
        if not isinstance(connection, SsrsConnection):
            raise InvalidSourceException(
                f"Expected SsrsConnection, but got {connection}"
            )
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.folder_path_map: Dict[str, str] = {}
        self._current_rdl: Optional[Tuple[str, SsrsReportDefinition]] = None

    def prepare(self):
        self.folder_path_map = {
            folder.path: folder.name for folder in self.client.get_folders()
        }
        return super().prepare()

    def get_dashboards_list(self) -> Iterable[SsrsReport]:
        for report in self.client.get_reports():
            if report.hidden:
                self.status.filter(report.name, "Hidden report")
                continue
            yield report

    def get_dashboard_name(self, dashboard: SsrsReport) -> str:
        return dashboard.name

    def get_dashboard_details(self, dashboard: SsrsReport) -> Optional[SsrsReport]:
        return dashboard

    def _get_report_definition(
        self, dashboard: SsrsReport
    ) -> Optional[SsrsReportDefinition]:
        """Fetch and cache the RDL for the dashboard currently being processed.

        Uses a single-entry cache keyed by report id so memory is bounded at
        O(1) across the ingestion run — the previous report's RDL is released
        the moment a new report is requested.

        ``SourceConnectionException`` propagates so that mark-deleted flows do
        not drop entities during a transient SSRS outage. ``ValueError`` from a
        malformed RDL is treated as a per-report problem and skipped."""
        if self._current_rdl and self._current_rdl[0] == dashboard.id:
            return self._current_rdl[1]
        self._current_rdl = None
        if dashboard.has_data_sources is False:
            return None
        rdl_bytes = self.client.get_report_definition(dashboard.id)
        if not rdl_bytes:
            return None
        try:
            parsed = parse_rdl(rdl_bytes)
        except ValueError as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Could not parse RDL for report [%s]: %s", dashboard.name, exc
            )
            return None
        self._current_rdl = (dashboard.id, parsed)
        return parsed

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:
        try:
            if isinstance(dashboard_details, SsrsReport) and dashboard_details.path:
                parts = dashboard_details.path.rsplit("/", 1)
                if len(parts) > 1 and parts[0]:
                    return self.folder_path_map.get(parts[0])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching project name: %s", exc)
        return None

    def get_owner_ref(
        self, dashboard_details: SsrsReport
    ) -> Optional[EntityReferenceList]:
        """Resolve the report's ``CreatedBy`` (``DOMAIN\\user``) to an OpenMetadata user.

        Defensive: missing owner, unknown user, or lookup failure are all logged and
        produce ``None`` so the rest of the dashboard ingestion continues."""
        try:
            if not self.source_config.includeOwners:
                return None
            owner_name = self._normalize_owner(dashboard_details.created_by)
            if not owner_name:
                return None
            owner_ref = self.metadata.get_reference_by_name(
                name=owner_name, is_owner=True
            )
            if owner_ref is None:
                logger.debug(
                    "Owner [%s] for report [%s] not found in OpenMetadata; "
                    "continuing without ownership",
                    owner_name,
                    dashboard_details.name,
                )
            return owner_ref
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                "Could not resolve owner for report [%s]: %s; "
                "continuing without ownership",
                dashboard_details.name,
                exc,
            )
        return None

    @staticmethod
    def _normalize_owner(raw: Optional[str]) -> Optional[str]:
        if not raw:
            return None
        _, sep, user = raw.rpartition("\\")
        candidate = user if sep else raw
        return candidate.strip() or None

    def yield_dashboard(
        self, dashboard_details: SsrsReport
    ) -> Iterable[Either[CreateDashboardRequest]]:
        try:
            dashboard_url = (
                f"{clean_uri(self.service_connection.hostPort)}"
                f"/report{dashboard_details.path}"
            )
            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                sourceUrl=SourceUrl(dashboard_url),
                displayName=dashboard_details.name,
                description=(
                    Markdown(dashboard_details.description)
                    if dashboard_details.description
                    else None
                ),
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
                project=self.context.get().project_name,
                service=self.context.get().dashboard_service,
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating dashboard [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: SsrsReport
    ) -> Iterable[Either[CreateChartRequest]]:
        try:
            chart_name = dashboard_details.name
            if filter_by_chart(self.source_config.chartFilterPattern, chart_name):
                self.status.filter(chart_name, "Chart Pattern not allowed")
                return
            chart_url = (
                f"{clean_uri(self.service_connection.hostPort)}"
                f"/report{dashboard_details.path}"
            )
            chart_request = CreateChartRequest(
                name=EntityName(f"{dashboard_details.id}_chart"),
                displayName=chart_name,
                description=(
                    Markdown(dashboard_details.description)
                    if dashboard_details.description
                    else None
                ),
                chartType=ChartType.Other.value,
                sourceUrl=SourceUrl(chart_url),
                service=self.context.get().dashboard_service,
            )
            yield Either(right=chart_request)
            self.register_record_chart(chart_request=chart_request)
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating chart [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_datamodel(
        self, dashboard_details: SsrsReport
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        if not self.source_config.includeDataModels:
            return
        rdl = self._get_report_definition(dashboard_details)
        if not rdl:
            return
        for dataset in rdl.data_sets:
            try:
                datamodel_request = self._build_datamodel_request(
                    dashboard_details, dataset
                )
                if datamodel_request is None:
                    continue
                yield Either(right=datamodel_request)
                self.register_record_datamodel(datamodel_request=datamodel_request)
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name}.{dataset.name}",
                        error=(
                            f"Error yielding DataModel [{dataset.name}] for report "
                            f"[{dashboard_details.name}]: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _build_datamodel_request(
        self, dashboard_details: SsrsReport, dataset: SsrsDataSet
    ) -> Optional[CreateDashboardDataModelRequest]:
        datamodel_name = self._datamodel_name(dashboard_details.id, dataset.name)
        sql = (
            dataset.command_text
            if dataset.command_text and dataset.command_type not in SKIP_COMMAND_TYPES
            else None
        )
        return CreateDashboardDataModelRequest(
            name=EntityName(datamodel_name),
            displayName=dataset.name,
            service=FullyQualifiedEntityName(self.context.get().dashboard_service),
            dataModelType=DataModelType.SsrsDataModel.value,
            serviceType=self.service_connection.type.value,
            sql=SqlQuery(sql) if sql else None,
            columns=self._build_datamodel_columns(dataset),
        )

    @staticmethod
    def _datamodel_name(report_id: str, dataset_name: str) -> str:
        return f"{report_id}.{dataset_name}"

    @staticmethod
    def _build_datamodel_columns(dataset: SsrsDataSet) -> List[Column]:
        columns: List[Column] = []
        for field_info in dataset.fields:
            try:
                columns.append(
                    Column(
                        name=field_info.name,
                        displayName=field_info.name,
                        dataType=DataType.UNKNOWN,
                        dataTypeDisplay="SSRS Field",
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    "Error building SSRS datamodel column [%s]: %s",
                    field_info.name,
                    exc,
                )
        return columns

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: SsrsReport,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        rdl = self._get_report_definition(dashboard_details)
        if not rdl:
            return

        (
            db_service_name,
            prefix_database,
            prefix_schema,
            _,
        ) = self.parse_db_service_prefix(db_service_prefix)

        db_service_entity = self._resolve_db_service(db_service_name)
        datasource_index = {ds.name: ds for ds in rdl.data_sources}

        for dataset in rdl.data_sets:
            datasource = datasource_index.get(dataset.data_source_name or "")
            context = _LineageContext(
                db_service_name=db_service_name,
                db_service_entity=db_service_entity,
                prefix_database=prefix_database,
                prefix_schema=prefix_schema,
                dialect=self._resolve_dialect(db_service_entity, datasource),
            )
            try:
                yield from self._yield_dataset_lineage(
                    dashboard_details, dataset, datasource, context
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.name}.{dataset.name}",
                        error=(
                            f"Error yielding lineage for dataset [{dataset.name}] "
                            f"in report [{dashboard_details.name}]: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _yield_dataset_lineage(
        self,
        dashboard_details: SsrsReport,
        dataset: SsrsDataSet,
        datasource: Optional[SsrsDataSource],
        context: _LineageContext,
    ) -> Iterable[Either[AddLineageRequest]]:
        if not self._is_dataset_lineage_eligible(dataset, datasource):
            return

        to_entity = self._resolve_lineage_target(dashboard_details, dataset)
        if to_entity is None:
            return

        try:
            lineage_parser = LineageParser(
                dataset.command_text,
                context.dialect,
                parser_type=self.get_query_parser_type(),
            )
        except Exception as exc:
            logger.debug("LineageParser failed for dataset [%s]: %s", dataset.name, exc)
            return

        default_database = datasource.database if datasource else None
        for source_table in lineage_parser.source_tables or []:
            yield from self._yield_table_to_target_lineage(
                source_table=str(source_table),
                to_entity=to_entity,
                command_text=dataset.command_text,
                context=context,
                default_database=default_database,
            )

    @staticmethod
    def _is_dataset_lineage_eligible(
        dataset: SsrsDataSet, datasource: Optional[SsrsDataSource]
    ) -> bool:
        if not dataset.command_text:
            logger.debug(
                "Skipping lineage for dataset [%s]: empty CommandText", dataset.name
            )
            return False
        if dataset.command_type in SKIP_COMMAND_TYPES:
            logger.debug(
                "Skipping lineage for dataset [%s]: command type [%s]",
                dataset.name,
                dataset.command_type,
            )
            return False
        if datasource and datasource.data_provider in MDX_PROVIDERS:
            logger.debug(
                "Skipping lineage for dataset [%s]: MDX data provider [%s]",
                dataset.name,
                datasource.data_provider,
            )
            return False
        if dataset.shared_reference:
            logger.debug(
                "Skipping lineage for dataset [%s]: shared dataset reference [%s]",
                dataset.name,
                dataset.shared_reference,
            )
            return False
        return True

    def _resolve_lineage_target(
        self, dashboard_details: SsrsReport, dataset: SsrsDataSet
    ) -> Optional[Union[DashboardDataModel, Dashboard]]:
        if self.source_config.includeDataModels:
            datamodel_fqn = fqn.build(
                metadata=self.metadata,
                entity_type=DashboardDataModel,
                service_name=self.context.get().dashboard_service,
                data_model_name=self._datamodel_name(
                    dashboard_details.id, dataset.name
                ),
            )
            return self.metadata.get_by_name(
                entity=DashboardDataModel, fqn=datamodel_fqn
            )
        dashboard_fqn = fqn.build(
            self.metadata,
            entity_type=Dashboard,
            service_name=self.context.get().dashboard_service,
            dashboard_name=dashboard_details.id,
        )
        return self.metadata.get_by_name(entity=Dashboard, fqn=dashboard_fqn)

    def _resolve_db_service(
        self, db_service_name: Optional[str]
    ) -> Optional[DatabaseService]:
        if not db_service_name:
            return None
        try:
            return self.metadata.get_by_name(
                entity=DatabaseService, fqn=db_service_name
            )
        except Exception as exc:
            logger.debug("Could not resolve DB service [%s]: %s", db_service_name, exc)
            return None

    @staticmethod
    def _resolve_dialect(
        db_service_entity: Optional[DatabaseService],
        datasource: Optional[SsrsDataSource] = None,
    ) -> Dialect:
        if db_service_entity and db_service_entity.serviceType:
            return ConnectionTypeDialectMapper.dialect_of(
                db_service_entity.serviceType.value
            )
        if datasource and datasource.data_provider:
            provider_dialect = DATA_PROVIDER_DIALECT.get(
                datasource.data_provider.upper()
            )
            if provider_dialect is not None:
                return provider_dialect
        return Dialect.TSQL

    def _yield_table_to_target_lineage(
        self,
        source_table: str,
        to_entity: Union[DashboardDataModel, Dashboard],
        command_text: str,
        context: _LineageContext,
        default_database: Optional[str],
    ) -> Iterable[Either[AddLineageRequest]]:
        split = fqn.split_table_name(source_table)
        table_name = split.get("table")
        if not table_name:
            return
        database_name = (
            context.prefix_database or split.get("database") or default_database
        )
        schema_name = context.prefix_schema or split.get("database_schema")
        if context.db_service_entity and database_name:
            database_name = get_database_name_for_lineage(
                context.db_service_entity, database_name
            )
        fqn_search_string = build_es_fqn_search_string(
            service_name=context.db_service_name or "*",
            database_name=database_name,
            schema_name=schema_name,
            table_name=table_name,
        )
        table_entity = self.metadata.search_in_any_service(
            entity_type=Table, fqn_search_string=fqn_search_string
        )
        if not table_entity:
            return
        lineage = self._get_add_lineage_request(
            to_entity=to_entity, from_entity=table_entity, sql=command_text
        )
        if lineage is not None:
            yield lineage

    def close(self):
        self.client.close()
        return super().close()
