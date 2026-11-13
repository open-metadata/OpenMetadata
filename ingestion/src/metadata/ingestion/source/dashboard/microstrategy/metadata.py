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
from collections.abc import Iterable

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
from metadata.ingestion.lineage.models import ConnectionTypeDialectMapper
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.lineage.sql_lineage import get_table_entities_from_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.microstrategy.client import MicroStrategyApiError, MicroStrategyClient
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
            try:
                for result in self.client.iter_search_results(project.id):
                    self.dashboard_listing.count_listed()
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

        (
            prefix_db_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)

        database_service = self.metadata.get_by_name(entity=DatabaseService, fqn=prefix_db_service_name)
        if not database_service:
            logger.warning("Database service [%s] from dbServicePrefixes was not found", prefix_db_service_name)
            return
        dialect = ConnectionTypeDialectMapper.dialect_of(database_service.serviceType.value)

        for dataset in dashboard_details.datasets:
            try:
                cube_sql = self.client.get_cube_sql_details(dashboard_details.projectId, dataset.id)
                if not cube_sql:
                    continue
                datamodel_entity = self.metadata.get_by_name(
                    entity=DashboardDataModel,
                    fqn=self._fqn(DashboardDataModel, data_model_name=dataset.id),
                )
                if not datamodel_entity:
                    logger.debug("Data model [%s] not found, skipping its lineage", dataset.id)
                    continue
                lineage_parser = LineageParser(cube_sql, dialect=dialect, parser_type=self.get_query_parser_type())
                for table in lineage_parser.source_tables:
                    table_entities = get_table_entities_from_query(
                        metadata=self.metadata,
                        service_names=prefix_db_service_name,
                        database_name="*",
                        database_schema="*",
                        table_name=str(table),
                    )
                    if not table_entities:
                        logger.debug("[%s] Table not found in metadata: %s", lineage_parser.query_hash, table)
                        continue
                    for table_entity in table_entities:
                        if not self._matches_prefix(
                            table_entity, prefix_database_name, prefix_schema_name, prefix_table_name
                        ):
                            continue
                        yield Either(
                            left=None,
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(id=Uuid(table_entity.id.root), type="table"),
                                    toEntity=EntityReference(
                                        id=Uuid(datamodel_entity.id.root), type="dashboardDataModel"
                                    ),
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
        for available_object in dataset.availableObjects or []:
            try:
                children = [MicroStrategyColumnParser.parse(form) for form in available_object.forms or []]
                datasource_columns.append(
                    Column(
                        name=ColumnName(truncate_column_name(available_object.name)),
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
