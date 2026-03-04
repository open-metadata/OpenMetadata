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
Hex source module with direct warehouse query support for lineage
"""
import traceback
from typing import Dict, Iterable, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.services.connections.dashboard.hexConnection import (
    HexConnection,
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
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.hex.connection import get_connection
from metadata.ingestion.source.dashboard.hex.models import Project
from metadata.ingestion.source.dashboard.hex.query_fetcher import (
    HexProjectLineage,
    HexQueryFetcher,
)
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

HEX_TAG_CATEGORY = "HexCategories"


class HexSource(DashboardServiceSource):
    """
    Hex Source Class with direct warehouse query support for lineage
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.client = get_connection(self.service_connection)
        self.projects = []  # We will populate this in `prepare`

        # Initialize lineage components
        self.hex_project_lineage: Dict[str, HexProjectLineage] = {}

        # Initialize query fetcher for lineage
        self.query_fetcher = HexQueryFetcher(metadata=metadata, lookback_days=7)

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: HexConnection = config.serviceConnection.root.config
        if not isinstance(connection, HexConnection):
            raise InvalidSourceException(
                f"Expected HexConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Fetch the list of projects, categories, and lineage data from warehouses"""
        # Fetch lineage data from warehouses if enabled
        if self.query_fetcher:
            db_service_prefixes = self.get_db_service_prefixes()
            if db_service_prefixes:
                logger.info(
                    f"Fetching Hex lineage using {len(db_service_prefixes)} database service prefixes"
                )

                for db_service_prefix in db_service_prefixes:
                    try:
                        logger.info(f"Processing service prefix: {db_service_prefix}")
                        projects_data_from_warehouse = (
                            self.query_fetcher.fetch_hex_queries_from_service_prefix(
                                db_service_prefix
                            )
                        )

                        # Store or merge data for each Hex project found in this warehouse
                        for (
                            project_id,
                            project_data,
                        ) in projects_data_from_warehouse.items():
                            if project_id not in self.hex_project_lineage:
                                # First time seeing this project - store all its data
                                self.hex_project_lineage[project_id] = project_data
                            else:
                                # Project already exists - merge new data
                                existing_project_data = self.hex_project_lineage[
                                    project_id
                                ]

                                # Add new tables (duplicates are automatically handled by add_tables method)
                                existing_project_data.add_tables(
                                    project_data.upstream_tables
                                )

                            logger.debug(
                                f"Found lineage for project {project_id}: "
                                f"{len(self.hex_project_lineage[project_id].upstream_tables)} upstream tables"
                            )

                    except Exception as e:
                        logger.error(
                            f"Error fetching lineage from prefix {db_service_prefix}: {e}"
                        )
                        logger.debug(traceback.format_exc())

                logger.info(
                    f"Total Hex projects with lineage: {len(self.hex_project_lineage)}"
                )

    def get_dashboards_list(self):
        """
        Get List of all dashboards
        """
        self.projects = self.client.get_projects()
        return self.projects

    def get_dashboard_name(self, dashboard: Project) -> str:
        """Get dashboard name"""
        return dashboard.title

    def get_dashboard_details(self, dashboard: Project) -> Project:
        """Get dashboard details - in Hex, we already have all details from list API"""
        return dashboard

    def get_owner_ref(
        self, dashboard_details: Project
    ) -> Optional[EntityReferenceList]:
        """
        Get owner from email
        """
        try:
            # Try owner first, then creator
            email = None
            if dashboard_details.owner and dashboard_details.owner.email:
                email = dashboard_details.owner.email
            elif dashboard_details.creator and dashboard_details.creator.email:
                email = dashboard_details.creator.email

            if email:
                return self.metadata.get_reference_by_email(email)
            return None
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    def yield_tags(
        self, dashboard_details: Project
    ) -> Iterable[Either[OMetaTagAndClassification]]:
        """Create classification and tags for dashboard"""
        tags = self._extract_tags_from_project(dashboard_details)
        if tags and self.source_config.includeTags:
            yield from get_ometa_tag_and_classification(
                tags=tags,
                classification_name=HEX_TAG_CATEGORY,
                tag_description="Hex Tag",
                classification_description="Tags associated with Hex projects",
                include_tags=self.source_config.includeTags,
                metadata=self.metadata,
            )

    def _extract_tags_from_project(self, dashboard_details):
        """Extract tag names from dashboard categories and status"""
        tags_list = []

        # Add category names as tags
        if dashboard_details.categories:
            for category in dashboard_details.categories:
                if category and category.name:
                    tags_list.append(category.name)

        # Add status name as tag
        if dashboard_details.status and dashboard_details.status.name:
            tags_list.append(dashboard_details.status.name)

        return list(set(tags_list)) if tags_list else []  # Remove duplicates

    def _get_dashboard_tags(self, dashboard_details):
        """Get tag labels for dashboard"""
        if self.source_config.includeTags:

            tags = self._extract_tags_from_project(dashboard_details)

            if tags:
                return get_tag_labels(
                    metadata=self.metadata,
                    tags=tags,
                    classification_name=HEX_TAG_CATEGORY,
                    include_tags=True,
                )

        return None

    def yield_dashboard(
        self, dashboard_details: Project
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """Method to Get Dashboard Entity"""
        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_details.id),
                displayName=dashboard_details.title,
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
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(self.client.get_project_url(dashboard_details)),
                tags=self._get_dashboard_tags(dashboard_details),
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)

        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error to yield dashboard for {dashboard_details.title}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: Project,
        db_service_prefix: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources using warehouse queries.
        """
        # Check if we have lineage data for this project
        project_lineage = self.hex_project_lineage.get(dashboard_details.id)
        if not project_lineage or not project_lineage.upstream_tables:
            logger.debug(f"No lineage found for Hex project: {dashboard_details.id}")
            return

        try:
            # Get the dashboard entity
            dashboard_fqn = fqn.build(
                self.metadata,
                entity_type=Dashboard,
                service_name=self.config.serviceName,
                dashboard_name=dashboard_details.id,
            )

            dashboard = self.metadata.get_by_name(entity=Dashboard, fqn=dashboard_fqn)
            if not dashboard:
                logger.warning(f"Dashboard not found in OpenMetadata: {dashboard_fqn}")
                return

            logger.info(
                f"Creating lineage for Hex project {dashboard_details.title} "
                f"with {len(project_lineage.upstream_tables)} upstream tables"
            )

            # Create lineage for each upstream table
            for table_entity in project_lineage.upstream_tables:
                try:
                    # We already have the table entity from query_fetcher
                    if not table_entity or not table_entity.id:
                        logger.debug("Table entity is None or has no ID")
                        continue

                    # Create lineage from table to dashboard
                    lineage_request = AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=table_entity.id, type="table"
                            ),
                            toEntity=EntityReference(id=dashboard.id, type="dashboard"),
                        )
                    )

                    yield Either(right=lineage_request)
                    logger.debug(
                        f"Added lineage: {table_entity.fullyQualifiedName.root} -> {dashboard_fqn}"
                    )

                except Exception as e:
                    table_fqn = (
                        table_entity.fullyQualifiedName.root
                        if table_entity
                        else "Unknown"
                    )
                    logger.error(f"Error creating lineage for table {table_fqn}: {e}")
                    yield Either(
                        left=StackTraceError(
                            name="Lineage",
                            error=f"Error creating lineage for table {table_fqn}: {e}",
                            stackTrace=traceback.format_exc(),
                        )
                    )

        except Exception as exc:
            logger.error(
                f"Error building lineage for dashboard {dashboard_details.id}: {exc}"
            )
            yield Either(
                left=StackTraceError(
                    name="Dashboard Lineage",
                    error=f"Error building lineage for dashboard {dashboard_details.id}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(
        self, dashboard_details: Project
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        Hex projects don't have separate charts - they are integrated within the project.
        Return empty iterator as we only ingest dashboards.
        """
        return
