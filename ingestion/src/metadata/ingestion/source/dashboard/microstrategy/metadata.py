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
"""MicroStrategy source module"""

import traceback
from collections import OrderedDict
from collections.abc import Iterable
from functools import partial
from typing import cast

from metadata.entity_resolution.table_search import get_table_fqn_from_query_name
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
    MicroStrategyConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
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
    Uuid,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.delete import DeleteEntity
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper, Dialect
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_table_entities_from_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.microstrategy.client import (
    MicroStrategyApiError,
    MicroStrategyClient,
    cached,
)
from metadata.ingestion.source.dashboard.microstrategy.helpers import (
    MicroStrategyColumnParser,
)
from metadata.ingestion.source.dashboard.microstrategy.models import (
    MstrDashboard,
    MstrDashboardDetails,
    MstrDataset,
    MstrPage,
    MstrVisualization,
)
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils import fqn
from metadata.utils.filters import (
    filter_by_chart,
    filter_by_dashboard,
    filter_by_datamodel,
    filter_by_project,
)
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# The column name limit that truncate_column_name applies
COLUMN_NAME_LENGTH = 256


def unique_column_name(name: str, taken: set[str]) -> str:
    """
    The server rejects a data model that repeats a column name, and MicroStrategy lets two
    objects of a dataset share one (an attribute and a metric, or two metrics).
    """
    candidate = truncate_column_name(name)
    suffix = 2
    while candidate in taken:
        # The suffix goes after the truncation, or a name at the length limit would lose it.
        tag = f" ({suffix})"
        candidate = truncate_column_name(name)[: COLUMN_NAME_LENGTH - len(tag)] + tag
        suffix += 1
    taken.add(candidate)
    return candidate


def chart_name(dossier_id: str, page_key: str, visualization_key: str) -> str:
    """
    Visualization keys (``W63``) and page keys (``K53``) are unique only within a dossier, so
    the dossier id is part of the name.
    ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
    """
    return f"{dossier_id}_{page_key}{visualization_key}"


class MicrostrategySource(DashboardServiceSource):
    """
    Microstrategy Source Class
    """

    client: MicroStrategyClient

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        # A project whose dossiers could not be listed hides dashboards that still exist.
        self.listing_failed = False
        # A dossier whose definition could not be read hides charts and data models that still exist.
        self.definition_failed = False
        # A dossier whose existing charts could not be read from OpenMetadata produced no charts.
        self.charts_unknown = False
        self._dialects: dict[str, Dialect | None] = {}
        self._service_databases: dict[str, frozenset[str]] = {}
        self._source_tables: OrderedDict[tuple[str, Dialect], tuple[str, ...] | None] = OrderedDict()

    @property
    def _service(self) -> str:
        return self.context.get().dashboard_service  # pyright: ignore[reportAttributeAccessIssue]

    def _fqn(self, entity_type: type, **names: str) -> str:
        entity_fqn = fqn.build(self.metadata, entity_type=entity_type, service_name=self._service, **names)
        if entity_fqn is None:
            raise ValueError(f"Cannot build the FQN of {entity_type.__name__} {names}")
        return entity_fqn

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: str | None = None,
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: MicroStrategyConnection = config.serviceConnection.root.config
        if not isinstance(connection, MicroStrategyConnection):
            raise InvalidSourceException(f"Expected MicroStrategyConnection, but got {connection}")
        return cls(config, metadata)

    def get_dashboards_list(self) -> Iterable[MstrDashboard]:  # pyright: ignore[reportIncompatibleMethodOverride]
        """
        List the dossiers of every project the filter keeps. Projects are filtered here, before
        their dossiers are searched or any definition is read.
        """
        try:
            projects = self.client.get_projects_list()
        except Exception as exc:
            self._fail_listing("projects", exc)
            return
        for project in projects:
            if filter_by_project(self.source_config.projectFilterPattern, project.name):
                self.status.filter(project.name, "Project Filtered Out")
                continue
            documents = 0
            try:
                for result in self.client.iter_search_results(project.id):
                    self.dashboard_listing.count_listed()
                    if not result.is_dossier:
                        # The dossier definition API answers HTTP 500 for a document.
                        documents += 1
                        self.dashboard_listing.count_filtered()
                        self.status.filter(result.name, "Not a dossier: Report Services documents are not ingested")
                        continue
                    # Filtered here as well as in the base, so the listing can count it.
                    if filter_by_dashboard(self.source_config.dashboardFilterPattern, result.name):
                        self.dashboard_listing.count_filtered()
                        self.status.filter(result.name, "Dashboard Filtered Out")
                        continue
                    yield MstrDashboard.model_validate(
                        {**result.model_dump(), "projectId": project.id, "projectName": project.name}
                    )
            except Exception as exc:
                self._fail_listing(f"the dossiers of project {project.name}", exc)
            if documents:
                self.status.warning(
                    project.name,
                    f"Skipped {documents} Report Services documents, templates or themes: only dossiers are ingested",
                )
        if self.client.skipped_objects:
            self._fail_listing(
                "every object", MicroStrategyApiError(f"{self.client.skipped_objects} objects did not parse")
            )
        # No project is never a confirmation: /projects lists only what the user may read, so
        # lost access looks like an empty server.
        if projects and not self.listing_failed:
            self.dashboard_listing.mark_complete()
            self.datamodel_listing.mark_complete()

    def _fail_listing(self, what: str, exc: Exception) -> None:
        self.listing_failed = True
        self.dashboard_listing.mark_failed()
        self.datamodel_listing.mark_failed()
        self.status.failed(
            StackTraceError(
                name=what,
                error=f"Failed to list {what}; stale entities will not be deleted in this run: {exc}",
                stackTrace=traceback.format_exc(),
            )
        )

    def get_dashboard_name(self, dashboard: MstrDashboard) -> str:
        return dashboard.name

    def get_project_name(self, dashboard_details: MstrDashboardDetails) -> str | None:
        return dashboard_details.projectName if dashboard_details else None

    def get_dashboard_details(self, dashboard: MstrDashboard) -> MstrDashboardDetails:
        """
        Read the dossier definition. When it cannot be read, the dossier is still ingested from
        its listing, so a definition the server fails to render does not delete the dashboard.
        """
        listed = dashboard.model_dump(exclude_none=True)
        try:
            definition = self.client.get_dashboard_details(dashboard.projectId, dashboard.id)
            return MstrDashboardDetails.model_validate({**definition, **listed})
        except Exception as exc:
            logger.debug(traceback.format_exc())
            self.definition_failed = True
            self.status.warning(
                dashboard.name,
                f"Could not read the definition of dossier [{dashboard.id}]; it is ingested without charts "
                f"and data models, and stale charts and data models are kept in this run: {exc}",
            )
            return MstrDashboardDetails.model_validate({**listed, "definition_read": False})

    def get_owner_ref(self, dashboard_details: MstrDashboardDetails) -> EntityReferenceList | None:
        """
        Match the dossier owner to an OpenMetadata user by the owner's default email address
        """
        if not self.source_config.includeOwners or not dashboard_details.owner:
            return None
        try:
            email = self.client.get_owner_email(dashboard_details.owner.id)
            return self.metadata.get_reference_by_email(email) if email else None
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not resolve the owner of dossier [%s]: %s", dashboard_details.name, exc)
        return None

    def yield_dashboard(self, dashboard_details: MstrDashboardDetails) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """
        charts = None
        if dashboard_details.charts_known:
            try:
                charts = self._chart_fqns(dashboard_details)
            except Exception as exc:
                self._charts_unknown(dashboard_details, exc)
        if charts is None:
            # Left as it is, and seen, so it is not deleted as stale.
            self.dashboard_source_state.add(self._fqn(Dashboard, dashboard_name=dashboard_details.id))
            return
        try:
            dashboard_url = f"{self.client.library_url}/app/{dashboard_details.projectId}/{dashboard_details.id}"
            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                displayName=dashboard_details.name,
                description=Markdown(dashboard_details.description) if dashboard_details.description else None,
                sourceUrl=SourceUrl(dashboard_url),
                project=dashboard_details.projectName,
                charts=charts,
                service=FullyQualifiedEntityName(self._service),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(left=None, right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:
            yield Either(
                right=None,
                left=StackTraceError(
                    name=dashboard_details.id,
                    error=f"Error yielding dashboard for {dashboard_details.name}: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
            )

    def _chart_fqns(self, dashboard_details: MstrDashboardDetails) -> list[FullyQualifiedEntityName]:
        """
        Without its definition a dossier's charts are unknown, and an empty chart list would
        unlink the charts of a dashboard ingested before, so it keeps the charts it has.
        """
        if dashboard_details.definition_read:
            charts_in_context = self.context.get().charts or []  # pyright: ignore[reportAttributeAccessIssue]
            return [FullyQualifiedEntityName(self._fqn(Chart, chart_name=chart)) for chart in charts_in_context]
        existing = self.metadata.get_by_name(
            entity=Dashboard, fqn=self._fqn(Dashboard, dashboard_name=dashboard_details.id), fields=["charts"]
        )
        charts = existing.charts.root if existing and existing.charts else []
        kept = [chart.fullyQualifiedName for chart in charts if chart.fullyQualifiedName]
        # Seen, so stale-chart deletion keeps them while it removes every other stale chart.
        self.chart_source_state.update(kept)
        return [FullyQualifiedEntityName(chart_fqn) for chart_fqn in kept]

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: MstrDashboardDetails,
        db_service_prefix: str | None = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Lineage from the tables a cube's SQL reads to the cube's data model. The database
        service is not guessed: lineage needs a configured dbServicePrefixes entry.
        """
        if not db_service_prefix or not dashboard_details.datasets:
            return

        service_name, database_name, schema_name, table_name = self.parse_db_service_prefix(db_service_prefix)
        if not service_name:
            return
        dialect = self._dialect_of(service_name)
        if not dialect:
            return

        for dataset in dashboard_details.datasets:
            try:
                source_tables = cached(
                    self._source_tables,
                    (dataset.id, dialect),
                    partial(self._parse_source_tables, dashboard_details.projectId, dataset.id, dialect),
                    f"the tables of cube {dataset.id}",
                )
                if not source_tables:
                    continue
                datamodel_entity = self.metadata.get_by_name(
                    entity=DashboardDataModel,
                    fqn=self._fqn(DashboardDataModel, data_model_name=dataset.id),
                )
                if not datamodel_entity:
                    logger.debug("Data model [%s] not found, skipping its lineage", dataset.id)
                    continue
                for table_entity in self._source_table_entities(
                    source_tables, service_name, database_name, schema_name, table_name
                ):
                    yield Either(
                        left=None,
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(id=Uuid(table_entity.id.root), type="table"),
                                toEntity=EntityReference(id=Uuid(datamodel_entity.id.root), type="dashboardDataModel"),
                                lineageDetails=LineageDetails(source=LineageSource.DashboardLineage),
                            )
                        ),
                    )
            except Exception as exc:
                yield Either(
                    right=None,
                    left=StackTraceError(
                        name=f"Lineage of data model {dataset.id}",
                        error=f"Error to yield dashboard lineage details for data model [{dataset.name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                )

    def _dialect_of(self, service_name: str) -> Dialect | None:
        """
        The dialect of a dbServicePrefixes service. A service that exists or is confirmed missing
        is remembered; a failed lookup is not, so it is tried again for the next dossier.
        """
        if service_name in self._dialects:
            return self._dialects[service_name]
        try:
            database_service = self.metadata.get_by_name(entity=DatabaseService, fqn=service_name)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not read database service [%s] from dbServicePrefixes: %s", service_name, exc)
            return None
        if not database_service:
            logger.warning("Database service [%s] from dbServicePrefixes was not found", service_name)
        dialect = (
            ConnectionTypeDialectMapper.dialect_of(database_service.serviceType.value) if database_service else None
        )
        # One entry per dbServicePrefixes service, so the configuration bounds it.
        self._dialects[service_name] = dialect
        return dialect

    def _parse_source_tables(self, project_id: str, cube_id: str, dialect: Dialect) -> tuple[str, ...]:
        """
        The tables a cube's SQL reads. Parsed once per cube and dialect: the base class asks
        for lineage once per dbServicePrefixes entry, and a cube is shared by many dossiers.
        """
        cube_sql = self.client.get_cube_sql_details(project_id, cube_id)
        if not cube_sql:
            return ()
        parser = LineageParser(cube_sql, dialect=dialect, parser_type=self.get_query_parser_type())
        # The third-party cached_property is not read as a descriptor by type checkers.
        return tuple(str(table) for table in cast("list", parser.source_tables))

    def _source_table_entities(
        self,
        source_tables: tuple[str, ...],
        service_name: str,
        database_name: str | None,
        schema_name: str | None,
        table_name: str | None,
    ) -> Iterable[Table]:
        for source_table in source_tables:
            if not self._may_hold(source_table, service_name, database_name):
                continue
            table_entities = get_table_entities_from_query(
                metadata=self.metadata,
                service_names=service_name,
                database_name="*",
                database_schema="*",
                table_name=source_table,
            )
            if not table_entities:
                logger.debug("Table [%s] not found in database service [%s]", source_table, service_name)
                continue
            yield from (
                table_entity
                for table_entity in table_entities
                if self._matches_prefix(table_entity, database_name, schema_name, table_name)
            )

    def _may_hold(self, source_table: str, service_name: str, database_name: str | None) -> bool:
        """
        Whether a prefix can hold a table the SQL names in a database (a BigQuery project): it
        must name that database, or the service must have it. Such a table is not searched for in
        the other services, which would only log that it is not there.
        """
        queried = get_table_fqn_from_query_name(source_table)[0]
        if not queried:
            return True
        if database_name:
            return database_name.lower() == queried.lower()
        databases = self._databases_of(service_name)
        return databases is None or queried.lower() in databases

    def _databases_of(self, service_name: str) -> frozenset[str] | None:
        """
        The database names of a dbServicePrefixes service, lowercased. A failed read is not
        remembered, and every database is then assumed possible.
        """
        if service_name not in self._service_databases:
            try:
                databases = self.metadata.list_all_entities(entity=Database, params={"service": service_name})
                names = frozenset(str(database.name.root).lower() for database in databases)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Could not list the databases of service [%s]: %s", service_name, exc)
                return None
            # One entry per dbServicePrefixes service, so the configuration bounds it.
            self._service_databases[service_name] = names
        return self._service_databases[service_name]

    @staticmethod
    def _matches_prefix(
        table_entity: Table, database_name: str | None, schema_name: str | None, table_name: str | None
    ):
        checks = (
            (table_name, table_entity.name.root),
            (schema_name, getattr(table_entity.databaseSchema, "name", None)),
            (database_name, getattr(table_entity.database, "name", None)),
        )
        return all(not wanted or not actual or wanted.lower() == str(actual).lower() for wanted, actual in checks)

    def yield_dashboard_chart(self, dashboard_details: MstrDashboardDetails) -> Iterable[Either[CreateChartRequest]]:
        """
        One chart per visualization of every page
        """
        try:
            existing = self.metadata.get_by_name(
                entity=Dashboard, fqn=self._fqn(Dashboard, dashboard_name=dashboard_details.id), fields=["charts"]
            )
        except Exception as exc:
            # Without the existing dashboard, new charts could not name it and a chart update
            # would unlink them, so the dossier's charts and dashboard are left as they are.
            self._charts_unknown(dashboard_details, exc)
            return
        # A chart update that leaves out its dashboards unlinks it from them, so a chart names its
        # dashboard once that exists. A new dashboard is created after its charts and links them.
        dashboards = [FullyQualifiedEntityName(existing.fullyQualifiedName.root)] if existing else None
        for page, visualization in self._visualizations(dashboard_details):
            if filter_by_chart(self.source_config.chartFilterPattern, visualization.name):
                self.status.filter(visualization.name, "Chart Pattern not allowed")
                continue
            try:
                chart_request = CreateChartRequest(
                    name=EntityName(chart_name(dashboard_details.id, page.key, visualization.key)),
                    displayName=visualization.name,
                    chartType=(
                        get_standard_chart_type(visualization.visualizationType)
                        if visualization.visualizationType
                        else None
                    ),
                    service=FullyQualifiedEntityName(self._service),
                    dashboards=dashboards,
                )
                yield Either(left=None, right=chart_request)
                self.register_record_chart(chart_request=chart_request)
            except Exception as exc:
                yield Either(
                    right=None,
                    left=StackTraceError(
                        name=f"Chart {visualization.key}",
                        error=f"Error creating chart [{visualization.name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                )

    @staticmethod
    def _visualizations(dashboard_details: MstrDashboardDetails) -> Iterable[tuple[MstrPage, MstrVisualization]]:
        for chapter in dashboard_details.chapters:
            for page in chapter.pages:
                for visualization in page.visualizations:
                    yield page, visualization

    def _charts_unknown(self, dashboard_details: MstrDashboardDetails, exc: Exception) -> None:
        logger.debug(traceback.format_exc())
        self.charts_unknown = True
        dashboard_details.charts_known = False
        self.status.warning(
            dashboard_details.name,
            f"Could not read the charts of dossier [{dashboard_details.id}] from OpenMetadata; its dashboard and "
            f"charts are left as they are and stale charts are kept in this run: {exc}",
        )

    def _get_column_info(self, dataset: MstrDataset) -> list[Column]:
        """Attributes become columns with their forms as children; metrics are leaf columns"""
        datasource_columns = []
        objects = dataset.availableObjects or []
        # Suffixes go out in id order, so an object keeps its column name, and what users added
        # to the column, when MicroStrategy lists the objects in another order.
        taken: set[str] = set()
        column_names: dict[str, str] = {}
        for available_object in sorted(objects, key=lambda obj: (obj.name, obj.id)):
            if available_object.id not in column_names:
                column_names[available_object.id] = unique_column_name(available_object.name, taken)
        seen_ids: set[str] = set()
        for available_object in objects:
            if available_object.id in seen_ids:
                logger.debug("Data model [%s] lists [%s] twice; keeping one", dataset.name, available_object.name)
                continue
            seen_ids.add(available_object.id)
            try:
                children = [MicroStrategyColumnParser.parse(form) for form in available_object.forms or []]
                datasource_columns.append(
                    Column(
                        name=ColumnName(column_names[available_object.id]),
                        displayName=available_object.name,
                        dataTypeDisplay=available_object.type.title(),
                        dataType=DataType.UNKNOWN,
                        children=children or None,
                    )
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning("Error to yield datamodel column [%s]: %s", available_object.name, exc)
        return datasource_columns

    def yield_datamodel(
        self, dashboard_details: MstrDashboardDetails
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        One data model per dataset (cube) of the dossier
        """
        if not self.source_config.includeDataModels:
            return
        for dataset in dashboard_details.datasets:
            self.datamodel_listing.count_listed()
            try:
                if filter_by_datamodel(self.source_config.dataModelFilterPattern, dataset.name):
                    self.datamodel_listing.count_filtered()
                    self.status.filter(dataset.name, "Data model filtered out.")
                    continue
                data_model_request = CreateDashboardDataModelRequest(
                    name=EntityName(dataset.id),
                    displayName=dataset.name,
                    service=FullyQualifiedEntityName(self._service),
                    dataModelType=DataModelType.MicroStrategyDataset,
                    serviceType=DashboardServiceType.MicroStrategy,
                    columns=self._get_column_info(dataset),
                    project=self.get_project_name(dashboard_details=dashboard_details),
                )
                yield Either(left=None, right=data_model_request)
                self.register_record_datamodel(datamodel_request=data_model_request)
            except Exception as exc:
                yield Either(
                    right=None,
                    left=StackTraceError(
                        name=dataset.name,
                        error=f"Error yielding Data Model [{dataset.name}]: {exc}",
                        stackTrace=traceback.format_exc(),
                    ),
                )

    def mark_dashboards_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        if self._keep_stale("dashboards", self.listing_failed):
            return
        yield from super().mark_dashboards_as_deleted()

    def mark_charts_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        # A dossier whose definition failed reports the charts it already had as seen.
        if self._keep_stale("charts", self.listing_failed or self.charts_unknown):
            return
        yield from super().mark_charts_as_deleted()

    def mark_datamodels_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        if self._keep_stale("data models", self.listing_failed or self.definition_failed):
            return
        yield from super().mark_datamodels_as_deleted()

    @staticmethod
    def _keep_stale(entities: str, partial: bool) -> bool:
        """
        The seen-set of a partial run lacks entities that still exist, and the server deletes
        whatever a non-empty seen-set leaves out, so a partial run deletes nothing.
        """
        if partial:
            logger.warning("Skipping the deletion of stale %s: this run could not read every source object", entities)
        return partial
