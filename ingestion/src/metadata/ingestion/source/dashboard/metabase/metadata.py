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
"""Metabase source module"""

import re
import traceback
from typing import Any, Dict, Iterable, List, Optional  # noqa: UP035

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart as LineageChart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.metabaseConnection import (
    MetabaseConnection,
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
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.metabase.models import (
    MetabaseChart,
    MetabaseCollection,
    MetabaseDashboard,
    MetabaseDashboardDetails,
)
from metadata.utils import fqn
from metadata.utils.constants import DEFAULT_DASHBAORD
from metadata.utils.filters import filter_by_chart
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import (
    clean_uri,
    get_standard_chart_type,
    replace_special_with,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_METABASE_ENGINE_DIALECT: Dict[str, Dialect] = {  # noqa: UP006
    "bigquery": Dialect.BIGQUERY,
    "bigquery-cloud-sdk": Dialect.BIGQUERY,
    "clickhouse": Dialect.CLICKHOUSE,
    "databricks": Dialect.DATABRICKS,
    "druid": Dialect.ANSI,
    "h2": Dialect.ANSI,
    "hive": Dialect.HIVE,
    "mongo": Dialect.ANSI,
    "mysql": Dialect.MYSQL,
    "oracle": Dialect.ORACLE,
    "postgres": Dialect.POSTGRES,
    "redshift": Dialect.REDSHIFT,
    "snowflake": Dialect.SNOWFLAKE,
    "sparksql": Dialect.SPARKSQL,
    "sqlite": Dialect.SQLITE,
    "sqlserver": Dialect.TSQL,
    "starrocks": Dialect.MYSQL,
    "trino": Dialect.TRINO,
    "vertica": Dialect.VERTICA,
}

_OPTIONAL_BLOCK_RE = re.compile(r"\[\[.*?\]\]", re.DOTALL)


class MetabaseSource(DashboardServiceSource):
    """
    Metabase Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None):  # noqa: UP045
        config = WorkflowSource.model_validate(config_dict)
        connection: MetabaseConnection = config.serviceConnection.root.config
        if not isinstance(connection, MetabaseConnection):
            raise InvalidSourceException(f"Expected MetabaseConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.collections: List[MetabaseCollection] = []  # noqa: UP006
        self.dashboards_list: List[MetabaseDashboard] = []  # noqa: UP006
        self.charts_dict: Dict[str] = {}  # noqa: UP006
        self.orphan_charts_id: List[str] = []  # noqa: UP006
        self._default_dashboard_added = False

    @staticmethod
    def _strip_optional_blocks(query: str) -> str:
        """Remove Metabase [[...]] optional clause blocks from a query.

        Metabase uses [[...]] to denote optional clauses that are only included
        when the enclosed variable has a value. These brackets are not valid SQL
        and must be removed before passing the query to any SQL parser.
        """
        return _OPTIONAL_BLOCK_RE.sub("", query)

    @staticmethod
    def _dialect_from_engine(engine: Optional[str]) -> Optional[Dialect]:  # noqa: UP045
        """Map a Metabase database engine name to a sqllineage Dialect."""
        if engine is None:
            return None
        return _METABASE_ENGINE_DIALECT.get(engine.lower())

    def prepare(self):
        self.collections = self.client.get_collections_list()
        self.charts_dict = self.client.get_charts_dict()
        logger.debug(f"Total chart IDs fetched: {list(self.charts_dict.keys())}")
        return super().prepare()

    def get_dashboards_list(self) -> Optional[List[MetabaseDashboard]]:  # noqa: UP006, UP045
        """
        Get List of all dashboards
        """
        if not self.source_config.includeOwners:
            logger.debug("Skipping owner information as includeOwners is False")
        self.dashboards_list = self.client.get_dashboards_list(self.collections)
        return self.dashboards_list

    def get_dashboard_name(self, dashboard: MetabaseDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: MetabaseDashboard) -> Optional[MetabaseDashboardDetails]:  # noqa: UP045
        """
        Get Dashboard Details
        """
        retrieved_dashboards = self.client.get_dashboard_details(dashboard.id, self.charts_dict, self.orphan_charts_id)
        if retrieved_dashboards and dashboard == self.dashboards_list[-1] and not self._default_dashboard_added:
            # If processing the last dashboard, identify any orphaned charts (not associated with dashboards)
            # and create a default dashboard to maintain visibility of these charts
            self.orphan_charts_id = [
                chart_id for chart_id, chart in self.charts_dict.items() if not chart.dashboard_ids
            ]
            if self.orphan_charts_id:
                # add the default dashboard to the dashboards list
                default_dashboard = MetabaseDashboard(
                    name=DEFAULT_DASHBAORD,
                    id=DEFAULT_DASHBAORD,
                )
                self.dashboards_list.append(default_dashboard)
                self._default_dashboard_added = True
        return retrieved_dashboards

    def get_project_name(self, dashboard_details: Any) -> Optional[str]:  # noqa: UP045
        """
        Method to get the project name by searching the dataset using id in the workspace dict
        """
        try:
            # Return default for the default dashboard containing orphaned charts
            if dashboard_details.id == DEFAULT_DASHBAORD:
                return DEFAULT_DASHBAORD
            if dashboard_details.collection_id:
                collection_name = next(
                    (
                        collection.name
                        for collection in self.collections
                        if collection.id == dashboard_details.collection_id
                    ),
                    None,
                )
                return collection_name  # noqa: RET504
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching the collection details for [{dashboard_details.collection_id}]: {exc}")
        return None

    def get_owner_ref(self, dashboard_details: MetabaseDashboardDetails) -> Optional[EntityReferenceList]:  # noqa: UP045
        """
        Get dashboard owner from email
        """
        try:
            if not self.source_config.includeOwners:
                return None
            if dashboard_details.creator_id:
                owner_details = self.client.get_user_details(dashboard_details.creator_id)
                if owner_details and owner_details.email:
                    return self.metadata.get_reference_by_email(owner_details.email)
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    def yield_dashboard(self, dashboard_details: MetabaseDashboardDetails) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        try:
            # dashboard_url to be empty for default dashboard
            dashboard_url = (
                ""
                if dashboard_details.id == DEFAULT_DASHBAORD
                else f"{clean_uri(self.service_connection.hostPort)}/dashboard/{dashboard_details.id}-"
                f"{replace_special_with(raw=dashboard_details.name.lower(), replacement='-')}"
            )

            dashboard_request = CreateDashboardRequest(
                name=EntityName(str(dashboard_details.id)),
                sourceUrl=SourceUrl(dashboard_url),
                displayName=dashboard_details.name,
                description=(Markdown(dashboard_details.description) if dashboard_details.description else None),
                project=self.context.get().project_name,
                charts=[
                    FullyQualifiedEntityName(
                        fqn.build(
                            self.metadata,
                            entity_type=LineageChart,
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
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=dashboard_details.name,
                    error=f"Error creating dashboard [{dashboard_details.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: MetabaseDashboardDetails
    ) -> Iterable[Either[CreateChartRequest]]:
        """Get chart method

        Args:
            dashboard_details:
        Returns:
            Iterable[CreateChartRequest]
        """
        chart_ids = dashboard_details.card_ids
        for chart_id in chart_ids:
            try:
                chart_details = self.charts_dict[chart_id]
                if not chart_details.id or not chart_details.name:
                    continue
                chart_url = (
                    f"{clean_uri(self.service_connection.hostPort)}/question/{chart_details.id}-"
                    f"{replace_special_with(raw=chart_details.name.lower(), replacement='-')}"
                )
                if filter_by_chart(self.source_config.chartFilterPattern, chart_details.name):
                    self.status.filter(chart_details.name, "Chart Pattern not allowed")
                    continue
                chart_request = CreateChartRequest(
                    name=EntityName(chart_details.id),
                    displayName=chart_details.name,
                    description=chart_details.description,
                    chartType=get_standard_chart_type(chart_details.display).value,
                    sourceUrl=SourceUrl(chart_url),
                    service=self.context.get().dashboard_service,
                )
                yield Either(right=chart_request)
                self.register_record_chart(chart_request=chart_request)
            except KeyError as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Chart with ID {chart_id} not found in charts_dict for dashboard [{dashboard_details.id}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error creating chart [{self.charts_dict[chart_id]}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: MetabaseDashboardDetails,
        db_service_prefix: Optional[str] = None,  # noqa: UP045
    ) -> Iterable[Either[AddLineageRequest]]:
        """Get lineage method

        Args:
            dashboard_details
        """
        chart_ids, dashboard_name = (
            dashboard_details.card_ids,
            str(dashboard_details.id),
        )
        for chart_id in chart_ids:
            try:
                chart_details: MetabaseChart = self.charts_dict.get(chart_id)
                if not chart_details:
                    continue

                if chart_details.dataset_query is None or chart_details.dataset_query.type is None:
                    logger.debug(
                        f"Skipping lineage for Chart(name={chart_details.name}, id={chart_details.id}) "
                        f"because dataset_query or dataset_query.type is None. "
                        f"dataset_query = {chart_details.dataset_query}"
                    )
                    continue
                if chart_details.dataset_query.type == "native":
                    yield from (
                        self._yield_lineage_from_query(
                            chart_details=chart_details,
                            db_service_prefix=db_service_prefix,
                            dashboard_name=dashboard_name,
                        )
                        or []
                    )

                # TODO: this method below only gets a single table, but if the chart of type query has a join the other
                # table_ids will be ignored within a nested object
                elif chart_details.dataset_query.type == "query":
                    if not chart_details.table_id:
                        continue
                    yield from (
                        self._yield_lineage_from_api(
                            chart_details=chart_details,
                            db_service_prefix=db_service_prefix,
                            dashboard_name=dashboard_name,
                        )
                        or []
                    )

            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Lineage",
                        error=f"Error adding lineage: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    def _get_database_service(self, db_service_name: Optional[str]):  # noqa: UP045
        if not db_service_name:
            return None
        return self.metadata.get_by_name(DatabaseService, db_service_name)

    def _get_chart_entity(self, chart_details: MetabaseChart) -> LineageChart | None:
        chart_fqn = fqn.build(
            self.metadata,
            entity_type=LineageChart,
            service_name=self.config.serviceName,
            chart_name=str(chart_details.id),
        )
        if not chart_fqn:
            return None
        return self.metadata.get_by_name(
            entity=LineageChart,
            fqn=chart_fqn,
        )

    # pylint: disable=too-many-locals
    def _yield_lineage_from_query(
        self,
        chart_details: MetabaseChart,
        db_service_prefix: Optional[str],  # noqa: UP045
        dashboard_name: str,
    ) -> Iterable[Either[AddLineageRequest]]:
        database = self.client.get_database(chart_details.database_id)

        (
            prefix_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)

        query = None
        if (
            chart_details.dataset_query
            and chart_details.dataset_query.native
            and chart_details.dataset_query.native.query
        ):
            query = self._strip_optional_blocks(chart_details.dataset_query.native.query)

        if query is None:
            return

        database_name = database.details.db if database and database.details else None

        db_service = self._get_database_service(prefix_service_name)

        if db_service:
            dialect = ConnectionTypeDialectMapper.dialect_of(db_service.serviceType.value)
        else:
            dialect = self._dialect_from_engine(database.engine if database else None) or Dialect.ANSI

        lineage_parser = LineageParser(
            query,
            dialect,
            parser_type=self.get_query_parser_type(),
        )
        query_hash = lineage_parser.query_hash

        if prefix_database_name and database_name and prefix_database_name.lower() != database_name.lower():
            logger.debug(f"[{query_hash}] Database {database_name} does not match prefix {prefix_database_name}")
            return

        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_name,
        )
        to_entity = (
            self.metadata.get_by_name(
                entity=LineageDashboard,
                fqn=to_fqn,
            )
            if to_fqn
            else None
        )
        chart_entity = self._get_chart_entity(chart_details)

        for table in lineage_parser.source_tables:
            database_schema_name, table = fqn.split(str(table))[-2:]  # noqa: PLW2901
            database_schema_name = self.check_database_schema_name(database_schema_name)

            if prefix_table_name and table and prefix_table_name.lower() != table.lower():
                logger.debug(f"Table {table} does not match prefix {prefix_table_name}")
                continue

            if (
                prefix_schema_name
                and database_schema_name
                and prefix_schema_name.lower() != database_schema_name.lower()
            ):
                logger.debug(f"Schema {database_schema_name} does not match prefix {prefix_schema_name}")
                continue

            fqn_search_string = build_es_fqn_search_string(
                database_name=prefix_database_name or database_name,
                schema_name=prefix_schema_name or database_schema_name,
                service_name=prefix_service_name or "*",
                table_name=prefix_table_name or table,
            )
            from_entities = self.metadata.search_in_any_service(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
                fetch_multiple_entities=True,
            )
            from_tables = [from_entities] if isinstance(from_entities, Table) else from_entities or []

            for from_entity in from_tables:
                if to_entity:
                    dashboard_lineage = self._get_add_lineage_request(
                        to_entity=to_entity,
                        from_entity=from_entity,
                    )
                    if dashboard_lineage:
                        yield dashboard_lineage
                if chart_entity and isinstance(from_entity, Table):
                    chart_lineage = self._get_add_lineage_request(to_entity=chart_entity, from_entity=from_entity)
                    if chart_lineage:
                        yield chart_lineage

    def _yield_lineage_from_api(
        self,
        chart_details: MetabaseChart,
        db_service_prefix: Optional[str],  # noqa: UP045
        dashboard_name: str,
    ) -> Iterable[Either[AddLineageRequest]]:
        table = self.client.get_table(chart_details.table_id)
        table_name = table.name or table.display_name

        if table is None or table_name is None:
            return

        (
            prefix_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)

        database_name = table.db.details.db if table.db and table.db.details else None

        if prefix_table_name and table_name and prefix_table_name.lower() != table_name.lower():
            logger.debug(f"Table {table_name} does not match prefix {prefix_table_name}")
            return

        if prefix_schema_name and table.table_schema and prefix_schema_name.lower() != table.table_schema.lower():
            logger.debug(f"Schema {table.table_schema} does not match prefix {prefix_schema_name}")
            return

        if prefix_database_name and database_name and prefix_database_name.lower() != database_name.lower():
            logger.debug(f"Database {database_name} does not match prefix {prefix_database_name}")
            return

        fqn_search_string = build_es_fqn_search_string(
            service_name=prefix_service_name or "*",
            database_name=prefix_database_name or database_name,
            schema_name=prefix_schema_name or table.table_schema,
            table_name=prefix_table_name or table_name,
        )
        from_entities = self.metadata.search_in_any_service(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            fetch_multiple_entities=True,
        )
        from_tables = [from_entities] if isinstance(from_entities, Table) else from_entities or []
        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_name,
        )

        to_entity = (
            self.metadata.get_by_name(
                entity=LineageDashboard,
                fqn=to_fqn,
            )
            if to_fqn
            else None
        )
        chart_entity = self._get_chart_entity(chart_details)

        for from_entity in from_tables:
            if to_entity:
                dashboard_lineage = self._get_add_lineage_request(
                    to_entity=to_entity,
                    from_entity=from_entity,
                )
                if dashboard_lineage:
                    yield dashboard_lineage
            if chart_entity and isinstance(from_entity, Table):
                chart_lineage = self._get_add_lineage_request(to_entity=chart_entity, from_entity=from_entity)
                if chart_lineage:
                    yield chart_lineage
