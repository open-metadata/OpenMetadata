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
Hex source module
"""
import traceback
from typing import Iterable, List, Optional

# from OpenMetadata.ingestion.src.metadata.generated.schema.entity.services.connections.dashboard import hexConnection
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
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
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.hex.models import Project
from metadata.ingestion.source.dashboard.hex.connection import get_connection

from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

HEX_TAG_CATEGORY = "HexCategories"


class HexSource(DashboardServiceSource):
    """
    Hex Source Class
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.client = get_connection(self.service_connection)
        self.projects = []  # We will populate this in `prepare`
        self.categories = []  # To create the categories as tags

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
        """Fetch the list of projects and categories"""
        # self.projects = self.client.get_projects()

        # Collect all categories for tag creation
        if self.service_connection.includeCategories:
            for project in self.projects:
                self.categories.extend(project.categories)

    def get_dashboards_list(self):
        """
        Get List of all dashboards
        """
        self.projects = self.client.get_projects()
        return self.projects

    def yield_bulk_tags(self, *_, **__) -> Iterable[Either[OMetaTagAndClassification]]:
        """Fetch Project Categories as Tags"""
        if self.service_connection.includeCategories:
            yield from get_ometa_tag_and_classification(
                tags=list(set(self.categories)),  # Use set to avoid duplicates
                classification_name=HEX_TAG_CATEGORY,
                tag_description="Hex Project Category",
                classification_description="Categories associated with Hex projects",
                include_tags=True,
            )

    # def get_dashboards_list(self) -> Optional[List[Project]]:
    #     """Return the list of projects"""
        # return self.projects

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
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=dashboard_details.categories,
                    classification_name=HEX_TAG_CATEGORY,
                    include_tags=self.service_connection.includeCategories,
                ),
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
        Get lineage between dashboard and data sources.
        Note: Hex API doesn't expose SQL queries or table dependencies in the standard API.
        This would require Enterprise features or additional API endpoints.
        """
        # Currently no lineage support without access to queries
        return []

    def yield_dashboard_chart(
        self, dashboard_details: Project
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard.
        In Hex, projects are both dashboards and apps, so we'll create a single chart per project.
        """
        try:
            chart_name = f"{dashboard_details.id}_chart"

            if filter_by_chart(
                self.source_config.chartFilterPattern, dashboard_details.title
            ):
                self.status.filter(dashboard_details.title, "Chart Pattern not allowed")
                return

            yield Either(
                right=CreateChartRequest(
                    name=EntityName(chart_name),
                    displayName=dashboard_details.title,
                    chartType=get_standard_chart_type("Other"),
                    service=FullyQualifiedEntityName(
                        self.context.get().dashboard_service
                    ),
                    sourceUrl=SourceUrl(self.client.get_project_url(dashboard_details)),
                    description=(
                        Markdown(dashboard_details.description)
                        if dashboard_details.description
                        else None
                    ),
                )
            )
        except Exception as exc:
            yield Either(
                left=StackTraceError(
                    name="Chart",
                    error=(
                        f"Error to yield dashboard chart for {dashboard_details.title}: {exc}"
                    ),
                    stackTrace=traceback.format_exc(),
                )
            )