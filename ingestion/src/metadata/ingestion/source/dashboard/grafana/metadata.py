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
Grafana source module
"""
import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.grafanaConnection import (
    GrafanaConnection,
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
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import clean_uri, get_standard_chart_type
from metadata.utils.logger import ingestion_logger
from metadata.utils.tag_utils import get_ometa_tag_and_classification, get_tag_labels

logger = ingestion_logger()

GRAFANA_TAG_CATEGORY = "GrafanaTags"


class GrafanaSource(DashboardServiceSource):
    """
    Grafana Source Class
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__(config, metadata)
        self.dashboard_list = []  # We will populate this in `prepare`
        self.tags = []  # To create the tags before yielding final entities
        self.folders = {}  # To store folder information

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: GrafanaConnection = config.serviceConnection.root.config
        if not isinstance(connection, GrafanaConnection):
            raise InvalidSourceException(
                f"Expected GrafanaConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Fetch the list of dashboards, folders, and tags"""
        try:
            # Fetch all dashboards
            self.dashboard_list = self.client.search_dashboards()

            # Fetch folders for organization context
            try:
                folders_response = self.client.get_folders()
                self.folders = {folder["uid"]: folder for folder in folders_response}
            except Exception as exc:
                logger.debug(f"Could not fetch folders: {exc}")
                self.folders = {}

            # Collecting all the tags
            if self.source_config.includeTags:
                try:
                    tags_response = self.client.get_dashboard_tags()
                    self.tags.extend(
                        tags_response if isinstance(tags_response, list) else []
                    )
                except Exception as exc:
                    logger.debug(f"Could not fetch tags: {exc}")

                # Also collect tags from dashboards
                for dashboard in self.dashboard_list:
                    if dashboard.get("tags"):
                        self.tags.extend(dashboard["tags"])

        except Exception as exc:
            logger.error(f"Error in prepare: {exc}")
            raise exc

    def yield_bulk_tags(self, *_, **__) -> Iterable[Either[OMetaTagAndClassification]]:
        """Fetch Dashboard Tags"""
        yield from get_ometa_tag_and_classification(
            tags=self.tags,
            classification_name=GRAFANA_TAG_CATEGORY,
            tag_description="Grafana Tag",
            classification_description="Tags associated with Grafana entities",
            include_tags=self.source_config.includeTags,
        )

    def get_dashboards_list(self) -> Optional[List[dict]]:
        return self.dashboard_list

    def get_dashboard_name(self, dashboard: dict) -> str:
        return dashboard.get("title", dashboard.get("uid", ""))

    def get_dashboard_details(self, dashboard: dict) -> dict:
        return self.client.get_dashboard_by_uid(dashboard["uid"])

    def get_owner_ref(self, dashboard_details) -> Optional[EntityReferenceList]:
        """
        Get owner from dashboard details
        """
        try:
            dashboard_info = dashboard_details.get("dashboard", {})
            created_by = dashboard_info.get("createdBy")
            if created_by:
                # Try to get owner by login/email
                if isinstance(created_by, dict) and created_by.get("email"):
                    return self.metadata.get_reference_by_email(created_by["email"])
                elif isinstance(created_by, dict) and created_by.get("login"):
                    return self.metadata.get_reference_by_email(created_by["login"])
            return None
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")
        return None

    def get_dashboard_url(self, dashboard_details: dict) -> str:
        """Build source URL"""
        dashboard_info = dashboard_details.get("dashboard", {})
        uid = dashboard_info.get("uid", "")
        dashboard_url = f"{clean_uri(self.service_connection.hostPort)}/d/{uid}"
        return dashboard_url

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """Method to Get Dashboard Entity"""
        try:
            dashboard_info = dashboard_details.get("dashboard", {})
            meta_info = dashboard_details.get("meta", {})

            # Get folder information if available
            folder_id = meta_info.get("folderId")
            folder_title = ""
            if folder_id and folder_id in self.folders:
                folder_title = self.folders[folder_id].get("title", "")

            dashboard_description = dashboard_info.get("description", "")
            if folder_title:
                dashboard_description = (
                    f"Folder: {folder_title}\n{dashboard_description}"
                )

            dashboard_request = CreateDashboardRequest(
                name=EntityName(dashboard_info.get("uid", "")),
                displayName=dashboard_info.get("title", ""),
                description=(
                    Markdown(dashboard_description) if dashboard_description else None
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
                sourceUrl=SourceUrl(self.get_dashboard_url(dashboard_details)),
                tags=get_tag_labels(
                    metadata=self.metadata,
                    tags=dashboard_info.get("tags", []),
                    classification_name=GRAFANA_TAG_CATEGORY,
                    include_tags=self.source_config.includeTags,
                ),
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

    def yield_dashboard_lineage_details(  # pylint: disable=too-many-locals
        self,
        dashboard_details: dict,
        db_service_name: Optional[str] = None,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        In Grafana, lineage is generated from panel queries
        """
        dashboard_info = dashboard_details.get("dashboard", {})
        dashboard_uid = dashboard_info.get("uid", "")

        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_uid,
        )
        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )

        panels = dashboard_info.get("panels", [])
        for panel in panels:
            try:
                targets = panel.get("targets", [])
                for target in targets:
                    raw_sql = target.get("rawSql", "")
                    if raw_sql:
                        lineage_parser = LineageParser(raw_sql)
                        for table in lineage_parser.source_tables:
                            table_name = str(table)
                            database_schema_table = fqn.split_table_name(table_name)
                            database_schema = database_schema_table.get(
                                "database_schema"
                            )
                            database_schema_name = self.check_database_schema_name(
                                database_schema
                            )
                            if not database_schema_table.get("table"):
                                continue
                            fqn_search_string = build_es_fqn_search_string(
                                database_name=database_schema_table.get("database"),
                                schema_name=database_schema_name,
                                service_name=db_service_name or "*",
                                table_name=database_schema_table.get("table"),
                            )
                            from_entity = self.metadata.search_in_any_service(
                                entity_type=Table,
                                fqn_search_string=fqn_search_string,
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

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Iterable[Either[CreateChartRequest]]:
        """Method to fetch charts (panels) linked to dashboard"""
        dashboard_info = dashboard_details.get("dashboard", {})
        panels = dashboard_info.get("panels", [])

        for panel in panels:
            try:
                panel_id = panel.get("id")
                panel_title = panel.get("title", f"Panel {panel_id}")
                panel_type = panel.get("type", "")

                if filter_by_chart(self.source_config.chartFilterPattern, panel_title):
                    self.status.filter(panel_title, "Chart Pattern not allowed")
                    continue

                # Get panel description
                panel_description = panel.get("description", "")

                yield Either(
                    right=CreateChartRequest(
                        name=EntityName(str(panel_id)),
                        displayName=panel_title,
                        chartType=get_standard_chart_type(panel_type),
                        service=FullyQualifiedEntityName(
                            self.context.get().dashboard_service
                        ),
                        sourceUrl=SourceUrl(self.get_dashboard_url(dashboard_details)),
                        description=(
                            Markdown(panel_description) if panel_description else None
                        ),
                    )
                )
            except Exception as exc:
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=(
                            "Error to yield dashboard chart for panel_id: "
                            f"{panel.get('id', 'unknown')} and {dashboard_details}: {exc}"
                        ),
                        stackTrace=traceback.format_exc(),
                    )
                )
