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
"""Rill dashboard source."""

import traceback
from collections.abc import Iterable
from typing import Any, NamedTuple, cast
from urllib.parse import quote

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
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.entity.services.connections.dashboard.rillConnection import (
    RillConnection,
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
    SqlQuery,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.models.ometa_lineage import OMetaLineageRequest
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.rill.client import (
    CANVAS_KIND,
    METRICS_VIEW_KIND,
    MODEL_KIND,
    RillApiClient,
    get_rill_cloud_project,
)
from metadata.ingestion.source.dashboard.rill.models import (
    RillCanvasSpec,
    RillComponentSpec,
    RillDataType,
    RillExploreSpec,
    RillMetricsViewSpec,
    RillModelSpec,
    RillResource,
)
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart, filter_by_datamodel
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DashboardSpec = RillExploreSpec | RillCanvasSpec

# Appended by list_datamodels after the last data model so yield_bulk_datamodel knows
# every model has been yielded and can flush and draw lineage without a dashboard.
_DATAMODEL_LINEAGE_SENTINEL = object()


class RillTableTarget(NamedTuple):
    database: str | None
    database_schema: str | None
    table: str
    sql: str | None = None


RILL_CHART_TYPE_OVERRIDES = {
    "combo": "bar",
    "donut": "pie",
    "kpi": "text",
    "kpi_grid": "text",
    "markdown": "text",
    "scatter_plot": "scatter",
    "stacked_bar": "bar",
}
RILL_DATA_TYPE_MAP = {
    "CODE_ARRAY": DataType.ARRAY,
    "CODE_BOOL": DataType.BOOLEAN,
    "CODE_BYTES": DataType.BYTES,
    "CODE_DATE": DataType.DATE,
    "CODE_DECIMAL": DataType.DECIMAL,
    "CODE_FLOAT32": DataType.FLOAT,
    "CODE_FLOAT64": DataType.DOUBLE,
    "CODE_INT8": DataType.TINYINT,
    "CODE_INT16": DataType.SMALLINT,
    "CODE_INT32": DataType.INT,
    "CODE_INT64": DataType.BIGINT,
    "CODE_INT128": DataType.LARGEINT,
    "CODE_INTERVAL": DataType.INTERVAL,
    "CODE_JSON": DataType.JSON,
    "CODE_MAP": DataType.MAP,
    "CODE_STRING": DataType.STRING,
    "CODE_STRUCT": DataType.STRUCT,
    "CODE_TIME": DataType.TIME,
    "CODE_TIMESTAMP": DataType.TIMESTAMP,
    "CODE_UINT8": DataType.UINT,
    "CODE_UINT16": DataType.UINT,
    "CODE_UINT32": DataType.UINT,
    "CODE_UINT64": DataType.UINT,
    "CODE_UUID": DataType.UUID,
}


def _error(name: str, error: str) -> Either:
    return Either(  # pyright: ignore[reportCallIssue]
        left=StackTraceError(name=name, error=error, stackTrace=traceback.format_exc())
    )


class RillSource(DashboardServiceSource):
    """Extract Explore and Canvas dashboards from Rill."""

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.client = cast("RillApiClient", self.client)
        self.components: dict[str, RillResource] = {}
        self.models: dict[str, RillResource] = {}
        self.metrics_views: dict[str, RillResource] = {}
        self.lineage_edges: set[tuple[str, str]] = set()

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ) -> "RillSource":
        config = WorkflowSource.model_validate(config_dict)
        connection = config.serviceConnection.root.config  # pyright: ignore[reportOptionalMemberAccess]
        if not isinstance(connection, RillConnection):
            raise InvalidSourceException(f"Expected RillConnection, but got {connection}")
        return cls(config, metadata)

    def prepare(self) -> None:
        components = self.client.get_components()
        self.components = {component.meta.name.name: component for component in components}
        logger.info("Found %d Rill components", len(self.components))

    def get_dashboards_list(self) -> list[RillResource] | None:
        return self.client.get_dashboards()

    def get_dashboard_name(self, dashboard: RillResource) -> str:
        return dashboard.meta.name.name

    def get_dashboard_details(self, dashboard: RillResource) -> RillResource:
        return self.client.get_resource(
            kind=dashboard.meta.name.kind,
            name=dashboard.meta.name.name,
        )

    def list_datamodels(self) -> Iterable[Any]:
        if not self.source_config.includeDataModels:
            return

        datamodels = self.client.get_datamodels()
        self.models = {
            resource.meta.name.name: resource for resource in datamodels if resource.meta.name.kind == MODEL_KIND
        }
        self.metrics_views = {
            resource.meta.name.name: resource for resource in datamodels if resource.meta.name.kind == METRICS_VIEW_KIND
        }
        logger.info("Found %d Rill models and %d Rill metrics views", len(self.models), len(self.metrics_views))
        yield from datamodels
        yield _DATAMODEL_LINEAGE_SENTINEL

    def _service_name(self) -> str:
        return self.context.get().dashboard_service  # pyright: ignore[reportAttributeAccessIssue]

    def _get_component(self, component_name: str) -> RillResource:
        component = self.components.get(component_name)
        if component is None:
            raise ValueError(f"Rill component [{component_name}] was not returned by the API")
        return component

    @staticmethod
    def _datamodel_name(kind: str, name: str) -> str:
        """Rill names are unique per kind only, and a metrics view commonly shares its
        model's name, so models carry a suffix to keep data model FQNs distinct."""
        return f"{name}_model" if kind == MODEL_KIND else name

    @staticmethod
    def _get_dashboard_spec(dashboard: RillResource) -> DashboardSpec:
        if dashboard.explore and dashboard.explore.effective_spec:
            return dashboard.explore.effective_spec
        if dashboard.canvas and dashboard.canvas.effective_spec:
            return dashboard.canvas.effective_spec
        raise ValueError(f"Rill dashboard [{dashboard.meta.name.name}] has no valid specification")

    @staticmethod
    def _get_component_spec(component: RillResource) -> RillComponentSpec:
        if component.component and component.component.effective_spec:
            return component.component.effective_spec
        raise ValueError(f"Rill component [{component.meta.name.name}] has no valid specification")

    @staticmethod
    def _get_metrics_view_spec(metrics_view: RillResource) -> RillMetricsViewSpec:
        if metrics_view.metrics_view and metrics_view.metrics_view.effective_spec:
            return metrics_view.metrics_view.effective_spec
        raise ValueError(f"Rill metrics view [{metrics_view.meta.name.name}] has no valid specification")

    @staticmethod
    def _get_model_spec(model: RillResource) -> RillModelSpec:
        if model.model and model.model.spec:
            return model.model.spec
        raise ValueError(f"Rill model [{model.meta.name.name}] has no valid specification")

    def _dashboard_url(self, dashboard: RillResource) -> str:
        dashboard_type = "canvas" if dashboard.meta.name.kind == CANVAS_KIND else "explore"
        dashboard_name = quote(dashboard.meta.name.name, safe="")
        host_port = clean_uri(str(self.service_connection.hostPort))
        cloud_project = get_rill_cloud_project(host_port)
        if cloud_project:
            org, project = cloud_project
            return (
                f"https://ui.rilldata.com/{quote(org, safe='')}/{quote(project, safe='')}/"
                f"{dashboard_type}/{dashboard_name}"
            )
        return f"{host_port}/{dashboard_type}/{dashboard_name}"

    def _project_url(self) -> str:
        host_port = clean_uri(str(self.service_connection.hostPort))
        cloud_project = get_rill_cloud_project(host_port)
        if cloud_project:
            org, project = cloud_project
            return f"https://ui.rilldata.com/{quote(org, safe='')}/{quote(project, safe='')}"
        return host_port

    def _project_name(self) -> str | None:
        cloud_project = get_rill_cloud_project(clean_uri(str(self.service_connection.hostPort)))
        return cloud_project[1] if cloud_project else None

    def get_project_name(self, dashboard_details: RillResource) -> str | None:
        return self._project_name()

    @staticmethod
    def _get_chart_type(renderer: str | None) -> ChartType:
        normalized_renderer = (renderer or "other").lower().replace("-", "_")
        normalized_renderer = normalized_renderer.removesuffix("_chart")
        normalized_renderer = RILL_CHART_TYPE_OVERRIDES.get(normalized_renderer, normalized_renderer)
        return get_standard_chart_type(normalized_renderer)

    @staticmethod
    def _get_column_data_type(data_type: RillDataType | None) -> DataType:
        if not data_type:
            return DataType.UNKNOWN
        if data_type.code in RILL_DATA_TYPE_MAP:
            return RILL_DATA_TYPE_MAP[data_type.code]
        if data_type.raw_type:
            return DataType.__members__.get(data_type.raw_type.upper(), DataType.UNKNOWN)
        return DataType.UNKNOWN

    @staticmethod
    def _get_field_description(
        description: str | None,
        expression: str | None,
    ) -> Markdown | None:
        parts = []
        if expression:
            parts.append(f"Expression: `{expression}`")
        if description:
            parts.append(description)
        return Markdown("\n\n".join(parts)) if parts else None

    @staticmethod
    def _get_resource_description(
        description: str | None,
    ) -> Markdown | None:
        return Markdown(description.strip()) if description and description.strip() else None

    @classmethod
    def _get_metrics_view_columns(
        cls,
        spec: RillMetricsViewSpec,
    ) -> list[Column]:
        columns: list[Column] = []
        seen_names: set[str] = set()

        def append_column(column: Column) -> None:
            name = column.name.root
            if name in seen_names:
                logger.warning("Skipping duplicate Rill metrics view column [%s]; column names must be unique", name)
                return
            seen_names.add(name)
            columns.append(column)

        for dimension in spec.dimensions:
            append_column(
                Column(  # pyright: ignore[reportCallIssue]
                    name=ColumnName(truncate_column_name(dimension.name)),
                    displayName=dimension.display_name or dimension.name,
                    dataType=cls._get_column_data_type(dimension.data_type),
                    dataTypeDisplay=(
                        dimension.data_type.raw_type
                        if dimension.data_type and dimension.data_type.raw_type
                        else "Rill Dimension"
                    ),
                    description=cls._get_field_description(
                        dimension.description,
                        dimension.expression,
                    ),
                )
            )
        for measure in spec.measures:
            append_column(
                Column(  # pyright: ignore[reportCallIssue]
                    name=ColumnName(truncate_column_name(measure.name)),
                    displayName=measure.display_name or measure.name,
                    dataType=DataType.MEASURE,
                    dataTypeDisplay=(
                        f"Rill Measure ({measure.data_type.raw_type})"
                        if measure.data_type and measure.data_type.raw_type
                        else "Rill Measure"
                    ),
                    description=cls._get_field_description(
                        measure.description,
                        measure.expression,
                    ),
                )
            )
        return columns

    def yield_bulk_datamodel(  # pyright: ignore[reportIncompatibleMethodOverride]
        self,
        datamodel: Any,
    ) -> Iterable[Either]:
        if datamodel is _DATAMODEL_LINEAGE_SENTINEL:
            yield from self._yield_bulk_datamodel_lineage()
            return

        datamodel_name = datamodel.meta.name.name
        if filter_by_datamodel(self.source_config.dataModelFilterPattern, datamodel_name):
            self.status.filter(datamodel_name, "Data model filtered out.")
            return

        try:
            if datamodel.meta.name.kind == METRICS_VIEW_KIND:
                spec = self._get_metrics_view_spec(datamodel)
                request = CreateDashboardDataModelRequest(  # pyright: ignore[reportCallIssue]
                    name=EntityName(datamodel_name),
                    displayName=spec.display_name or datamodel_name,
                    description=self._get_resource_description(spec.description),
                    service=FullyQualifiedEntityName(self._service_name()),
                    serviceType=self.service_connection.type.value,
                    dataModelType=DataModelType.RillMetricsView,
                    columns=self._get_metrics_view_columns(spec),
                    project=self._project_name(),
                    sourceUrl=SourceUrl(self._project_url()),
                )
            elif datamodel.meta.name.kind == MODEL_KIND:
                spec = self._get_model_spec(datamodel)
                sql = spec.input_properties.get("sql")
                request = CreateDashboardDataModelRequest(  # pyright: ignore[reportCallIssue]
                    name=EntityName(self._datamodel_name(MODEL_KIND, datamodel_name)),
                    displayName=datamodel_name,
                    service=FullyQualifiedEntityName(self._service_name()),
                    serviceType=self.service_connection.type.value,
                    dataModelType=DataModelType.RillModel,
                    columns=[],
                    sql=SqlQuery(sql) if isinstance(sql, str) and sql else None,
                    project=self._project_name(),
                    sourceUrl=SourceUrl(self._project_url()),
                )
            else:
                return

            yield Either(right=request)  # pyright: ignore[reportCallIssue]
            self.register_record_datamodel(request)
        except Exception as exc:
            yield _error(datamodel_name, f"Error creating Rill data model [{datamodel_name}]: {exc}")

    def yield_dashboard(self, dashboard_details: RillResource) -> Iterable[Either[CreateDashboardRequest]]:
        try:
            spec = self._get_dashboard_spec(dashboard_details)
            dashboard_name = dashboard_details.meta.name.name
            chart_fqns = [
                chart_fqn
                for chart in self.context.get().charts or []  # pyright: ignore[reportAttributeAccessIssue]
                if (
                    chart_fqn := fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self._service_name(),
                        chart_name=chart,
                    )
                )
            ]
            dashboard_request = CreateDashboardRequest(  # pyright: ignore[reportCallIssue]
                name=EntityName(dashboard_name),
                displayName=spec.display_name or dashboard_name,
                description=self._get_resource_description(spec.description),
                charts=[FullyQualifiedEntityName(chart_fqn) for chart_fqn in chart_fqns],
                service=FullyQualifiedEntityName(self._service_name()),
                sourceUrl=SourceUrl(self._dashboard_url(dashboard_details)),
            )
            yield Either(right=dashboard_request)  # pyright: ignore[reportCallIssue]
            self.register_record(dashboard_request)
        except Exception as exc:
            yield _error(
                dashboard_details.meta.name.name,
                f"Error creating Rill dashboard [{dashboard_details.meta.name.name}]: {exc}",
            )

    def yield_dashboard_chart(self, dashboard_details: RillResource) -> Iterable[Either[CreateChartRequest]]:
        if not dashboard_details.canvas or not dashboard_details.canvas.effective_spec:
            return

        component_names = dict.fromkeys(dashboard_details.canvas.effective_spec.iter_component_names())
        for component_name in component_names:
            try:
                component = self._get_component(component_name)
                spec = self._get_component_spec(component)
                display_name = spec.display_name or component_name
                if filter_by_chart(self.source_config.chartFilterPattern, display_name):
                    self.status.filter(display_name, "Chart Pattern not allowed")
                    continue

                chart_request = CreateChartRequest(  # pyright: ignore[reportCallIssue]
                    name=EntityName(component_name),
                    displayName=display_name,
                    description=self._get_resource_description(spec.description),
                    chartType=self._get_chart_type(spec.renderer),
                    service=FullyQualifiedEntityName(self._service_name()),
                    sourceUrl=SourceUrl(self._dashboard_url(dashboard_details)),
                )
                yield Either(right=chart_request)  # pyright: ignore[reportCallIssue]
                self.register_record_chart(chart_request)
            except Exception as exc:
                yield _error(component_name, f"Error creating Rill chart [{component_name}]: {exc}")

    def _get_dashboard_metrics_views(self, dashboard: RillResource) -> list[str]:
        metrics_views = {}
        for reference in dashboard.meta.refs:
            if reference.kind == METRICS_VIEW_KIND:
                metrics_views[reference.name] = None

        if dashboard.explore and dashboard.explore.effective_spec:
            metrics_view = dashboard.explore.effective_spec.metrics_view
            if metrics_view:
                metrics_views[metrics_view] = None

        if dashboard.canvas and dashboard.canvas.effective_spec:
            for component_name in dict.fromkeys(dashboard.canvas.effective_spec.iter_component_names()):
                component = self.components.get(component_name)
                if not component:
                    continue
                for reference in component.meta.refs:
                    if reference.kind == METRICS_VIEW_KIND:
                        metrics_views[reference.name] = None
                if not (component.component and component.component.effective_spec):
                    continue
                spec = component.component.effective_spec
                metrics_view = spec.renderer_properties.get("metrics_view") or spec.renderer_properties.get(
                    "metricsView"
                )
                if isinstance(metrics_view, str) and metrics_view:
                    metrics_views[metrics_view] = None

        return list(metrics_views)

    def _get_datamodel_entity(self, kind: str, datamodel_name: str) -> DashboardDataModel:
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self._service_name(),
            data_model_name=self._datamodel_name(kind, datamodel_name),
        )
        entity = self.metadata.get_by_name(entity=DashboardDataModel, fqn=datamodel_fqn) if datamodel_fqn else None
        if entity is None:
            raise ValueError(f"Rill data model [{datamodel_name}] was not found in OpenMetadata")
        return entity

    def _get_dashboard_entity(self, dashboard_name: str) -> Dashboard:
        dashboard_fqn = fqn.build(
            self.metadata,
            entity_type=Dashboard,
            service_name=self._service_name(),
            dashboard_name=dashboard_name,
        )
        entity = self.metadata.get_by_name(entity=Dashboard, fqn=dashboard_fqn) if dashboard_fqn else None
        if entity is None:
            raise ValueError(f"Rill dashboard [{dashboard_name}] was not found in OpenMetadata")
        return entity

    @staticmethod
    def _matches_prefix(resource_name: str | None, prefix_name: str | None) -> bool:
        return not resource_name or not prefix_name or resource_name.lower() == prefix_name.lower()

    def _get_table_entities(
        self,
        target: RillTableTarget,
        db_service_prefix: str | None,
    ) -> list[Table]:
        (
            service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)

        if not all(
            (
                self._matches_prefix(target.database, prefix_database_name),
                self._matches_prefix(target.database_schema, prefix_schema_name),
                self._matches_prefix(target.table, prefix_table_name),
            )
        ):
            logger.debug(
                "Skipping Rill table target [%s.%s.%s] because it does not match database service prefix [%s]",
                target.database,
                target.database_schema,
                target.table,
                db_service_prefix,
            )
            return []

        fqn_search_string = build_es_fqn_search_string(
            database_name=prefix_database_name or target.database or "*",
            schema_name=prefix_schema_name or target.database_schema,
            service_name=service_name or "*",
            table_name=prefix_table_name or target.table,
        )
        tables = self.metadata.search_in_any_service(
            entity_type=Table,
            fqn_search_string=fqn_search_string,
            fetch_multiple_entities=True,
        )
        if isinstance(tables, list):
            return tables
        return [tables] if tables else []

    def _get_physical_table_targets(self, resource: RillResource) -> list[RillTableTarget]:
        internal_model_names = {reference.name for reference in resource.meta.refs if reference.kind == MODEL_KIND}

        def is_internal(table_name: str) -> bool:
            return table_name in internal_model_names or table_name in self.models

        if resource.meta.name.kind == METRICS_VIEW_KIND:
            spec = self._get_metrics_view_spec(resource)
            if spec.parent:
                return []

            # Metrics views on external connectors may name the table via `model`.
            table_name = spec.table or spec.model
            if not table_name or is_internal(table_name):
                return []

            return [
                RillTableTarget(
                    database=spec.database,
                    database_schema=spec.database_schema,
                    table=table_name,
                )
            ]

        if resource.meta.name.kind != MODEL_KIND:
            return []

        spec = self._get_model_spec(resource)
        sql = spec.input_properties.get("sql")
        if not isinstance(sql, str) or not sql.strip():
            return []

        targets = {}
        lineage_parser = LineageParser(
            sql,
            parser_type=self.get_query_parser_type(),
        )
        for source_table in lineage_parser.source_tables:  # pyright: ignore[reportGeneralTypeIssues]
            table_parts = fqn.split_table_name(str(source_table))
            table_name = table_parts.get("table")
            if not table_name or is_internal(table_name):
                continue

            database_schema = table_parts.get("database_schema")
            target = RillTableTarget(
                database=table_parts.get("database"),
                database_schema=self.check_database_schema_name(database_schema) if database_schema else None,
                table=table_name,
                sql=sql,
            )
            targets[(target.database, target.database_schema, target.table)] = target

        return list(targets.values())

    def _yield_physical_table_lineage(
        self,
        resource: RillResource,
        downstream: DashboardDataModel,
        db_service_prefixes: list[str | None],
    ) -> Iterable[Either[AddLineageRequest]]:
        for target in self._get_physical_table_targets(resource):
            for db_service_prefix in db_service_prefixes:
                table_entities = self._get_table_entities(target, db_service_prefix)
                if not table_entities:
                    logger.debug(
                        "No OpenMetadata table found for Rill data model [%s] target [%s.%s.%s] "
                        "with database service prefix [%s]",
                        resource.meta.name.name,
                        target.database,
                        target.database_schema,
                        target.table,
                        db_service_prefix,
                    )
                    continue

                for table_entity in table_entities:
                    table_key = (
                        model_str(table_entity.fullyQualifiedName) if table_entity.fullyQualifiedName else target.table
                    )
                    edge_key = (f"table:{table_key}", f"datamodel:{resource.meta.name.name}")
                    if edge_key in self.lineage_edges:
                        continue
                    lineage = self._get_add_lineage_request(
                        to_entity=downstream,
                        from_entity=table_entity,
                        sql=target.sql,
                    )
                    if lineage:
                        self.lineage_edges.add(edge_key)
                        yield lineage

    def _yield_datamodel_ref_lineage(
        self,
        resource: RillResource,
        downstream: DashboardDataModel,
    ) -> Iterable[Either[AddLineageRequest]]:
        references = dict.fromkeys(
            (reference.kind, reference.name)
            for reference in resource.meta.refs
            if reference.kind in {MODEL_KIND, METRICS_VIEW_KIND}
        )
        for kind, upstream_name in references:
            if filter_by_datamodel(self.source_config.dataModelFilterPattern, upstream_name):
                continue
            edge_key = (f"datamodel:{upstream_name}", f"datamodel:{resource.meta.name.name}")
            if edge_key in self.lineage_edges:
                continue
            try:
                upstream = self._get_datamodel_entity(kind, upstream_name)
            except Exception as exc:
                yield _error(
                    upstream_name,
                    (
                        f"Error creating Rill data model lineage from [{upstream_name}] "
                        f"to [{resource.meta.name.name}]: {exc}"
                    ),
                )
                continue
            lineage = self._get_add_lineage_request(to_entity=downstream, from_entity=upstream)
            if lineage:
                self.lineage_edges.add(edge_key)
                yield lineage

    def _yield_bulk_datamodel_lineage(self) -> Iterable[Either]:
        """Flush the written data models, then draw model-to-model and physical table
        lineage for every data model, whether or not a dashboard uses it."""
        yield Either(right=Barrier(reason="rill_datamodel_lineage_flush"))  # pyright: ignore[reportCallIssue]
        db_service_prefixes: list[str | None] = list(self.get_db_service_prefixes() or [None])
        for resource in [*self.models.values(), *self.metrics_views.values()]:
            datamodel_name = resource.meta.name.name
            if filter_by_datamodel(self.source_config.dataModelFilterPattern, datamodel_name):
                continue
            try:
                downstream = self._get_datamodel_entity(resource.meta.name.kind, datamodel_name)
                for lineage in self._yield_datamodel_ref_lineage(resource, downstream):
                    yield from self.yield_lineage_request(lineage)
                for lineage in self._yield_physical_table_lineage(resource, downstream, db_service_prefixes):
                    yield from self.yield_lineage_request(lineage)
            except Exception as exc:
                yield _error(datamodel_name, f"Error creating Rill data model lineage for [{datamodel_name}]: {exc}")

    def _yield_dashboard_datamodel_lineage(
        self,
        dashboard: RillResource,
    ) -> Iterable[Either[AddLineageRequest]]:
        dashboard_name = dashboard.meta.name.name
        try:
            dashboard_entity = self._get_dashboard_entity(dashboard_name)
        except Exception as exc:
            yield _error(dashboard_name, f"Error creating Rill dashboard lineage for [{dashboard_name}]: {exc}")
            return

        for metrics_view_name in self._get_dashboard_metrics_views(dashboard):
            if filter_by_datamodel(self.source_config.dataModelFilterPattern, metrics_view_name):
                continue
            edge_key = (f"datamodel:{metrics_view_name}", f"dashboard:{dashboard_name}")
            if edge_key in self.lineage_edges:
                continue
            try:
                metrics_view_entity = self._get_datamodel_entity(METRICS_VIEW_KIND, metrics_view_name)
                lineage = self._get_add_lineage_request(
                    to_entity=dashboard_entity,
                    from_entity=metrics_view_entity,
                )
                if lineage:
                    self.lineage_edges.add(edge_key)
                    yield lineage
            except Exception as exc:
                yield _error(
                    metrics_view_name,
                    (
                        f"Error creating Rill lineage from metrics view [{metrics_view_name}] "
                        f"to dashboard [{dashboard_name}]: {exc}"
                    ),
                )

    def yield_dashboard_lineage(self, dashboard_details: Any) -> Iterable[Either[OMetaLineageRequest]]:
        """Only metrics view -> dashboard edges are drawn per dashboard; model lineage
        is emitted once from the bulk data model stage."""
        if not self.source_config.includeDataModels:
            return
        yield Either(right=Barrier(reason="rill_dashboard_lineage_flush"))  # pyright: ignore[reportCallIssue]
        for lineage in self._yield_dashboard_datamodel_lineage(dashboard_details):
            yield from self.yield_lineage_request(lineage)

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: Any,
        db_service_prefix: str | None = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """Unused: see yield_dashboard_lineage and _yield_bulk_datamodel_lineage."""
        return []
