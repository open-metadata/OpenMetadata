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
"""
Tableau source module
"""
import json
import traceback
from typing import Iterable, List, Optional

from pydantic import BaseModel, Extra
from requests.utils import urlparse
from tableau_api_lib.utils import extract_pages

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.tableauConnection import (
    TableauConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.tags.tagCategory import Tag
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.constants import (
    TABLEAU_GET_VIEWS_PARAM_DICT,
    TABLEAU_GET_WORKBOOKS_PARAM_DICT,
)
from metadata.utils.filters import filter_by_chart
from metadata.utils.graphql_queries import TABLEAU_LINEAGE_GRAPHQL_QUERY
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TABLEAU_TAG_CATEGORY = "TableauTags"


class TableauBaseModel(BaseModel):
    """
    Tableau basic configurations
    """

    class Config:
        extra = Extra.allow

    id: str
    name: str


class TableauOwner(TableauBaseModel):
    """
    Tableau Owner Details
    """

    email: str


class TableauChart(TableauBaseModel):
    """
    Chart (View) representation from API
    """

    workbook_id: str
    sheet_type: str
    view_url_name: str
    tags: List[str]


class TableauDashboard(TableauBaseModel):
    """
    Response from Tableau API
    """

    description: Optional[str]
    tags: List[str]
    owner: TableauOwner
    charts: Optional[List[TableauChart]]
    webpage_url: Optional[str]


class TableauSource(DashboardServiceSource):
    """
    Tableau Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: SourceStatus

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):

        super().__init__(config, metadata_config)
        self.workbooks = None  # We will populate this in `prepare`
        self.tags = set()  # To create the tags before yielding final entities
        self.workbook_datasources = {}

    def prepare(self):
        """
        Restructure the API response to
        """
        # Available fields information:
        # https://help.tableau.com/current/api/rest_api/en-us/REST/rest_api_concepts_fields.htm#query_workbooks_site
        # We can also get project.description as folder
        self.workbooks = [
            TableauDashboard(
                id=workbook["id"],
                name=workbook["name"],
                description=workbook.get("description"),
                tags=[
                    tag["label"] for tag in workbook.get("tags", {}).get("tag") or []
                ],
                owner=TableauOwner(
                    id=workbook.get("owner", {}).get("id"),
                    name=workbook.get("owner", {}).get("name"),
                    email=workbook.get("owner", {}).get("email"),
                ),
                webpage_url=workbook.get("webpageUrl"),
            )
            for workbook in extract_pages(
                self.client.query_workbooks_for_site,
                parameter_dict=TABLEAU_GET_WORKBOOKS_PARAM_DICT,
            )
        ]

        # For charts, we can also pick up usage as a field
        charts = [
            TableauChart(
                id=chart["id"],
                name=chart["name"],
                # workbook.id is always included in the response
                workbook_id=chart["workbook"]["id"],
                sheet_type=chart["sheetType"],
                view_url_name=chart["viewUrlName"],
                tags=[tag["label"] for tag in chart.get("tags", {}).get("tag") or []],
            )
            for chart in extract_pages(
                self.client.query_views_for_site,
                content_id=self.client.site_id,
                parameter_dict=TABLEAU_GET_VIEWS_PARAM_DICT,
            )
        ]

        # Add all the charts (views) from the API to each workbook
        for workbook in self.workbooks:
            workbook.charts = [
                chart for chart in charts if chart.workbook_id == workbook.id
            ]

        # Collecting all view & workbook tags
        for container in [self.workbooks, charts]:
            for elem in container:
                self.tags.update(elem.tags)

        if self.source_config.dbServiceNames:
            try:
                # Fetch Datasource information for lineage
                graphql_query_result = self.client.metadata_graphql_query(
                    query=TABLEAU_LINEAGE_GRAPHQL_QUERY
                )
                self.workbook_datasources = json.loads(graphql_query_result.text)[
                    "data"
                ].get("workbooks")
            except Exception:
                logger.debug(traceback.format_exc())
                logger.warning(
                    "\nSomething went wrong while connecting to Tableau Metadata APIs\n"
                    "Please check if the Tableau Metadata APIs are enabled for you Tableau instance\n"
                    "For more information on enabling the Tableau Metadata APIs follow the link below\n"
                    "https://help.tableau.com/current/api/metadata_api/en-us/docs/meta_api_start.html"
                    "#enable-the-tableau-metadata-api-for-tableau-server\n"
                )

        return super().prepare()

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: TableauConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, TableauConnection):
            raise InvalidSourceException(
                f"Expected TableauConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> Optional[List[TableauDashboard]]:
        """
        Get List of all dashboards
        """
        return self.workbooks

    def get_dashboard_name(self, dashboard: TableauDashboard) -> str:
        """
        Get Dashboard Name
        """
        return dashboard.name

    def get_dashboard_details(self, dashboard: TableauDashboard) -> TableauDashboard:
        """
        Get Dashboard Details. Returning the identity here as we prepare everything
        during the `prepare` stage
        """
        return dashboard

    def get_owner_details(
        self, dashboard_details: TableauDashboard
    ) -> Optional[EntityReference]:
        """Get dashboard owner

        Args:
            dashboard_details:
        Returns:
            Optional[EntityReference]
        """
        if dashboard_details.owner.email:
            user = self.metadata.get_user_by_email(dashboard_details.owner.email)
            if user:
                return EntityReference(id=user.id.__root__, type="user")
        return None

    def yield_tag(self, _) -> OMetaTagAndCategory:  # pylint: disable=arguments-differ
        """
        Fetch Dashboard Tags
        """
        for tag in self.tags:
            tag_category = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=TABLEAU_TAG_CATEGORY,
                    description="Tags associates with tableau entities",
                ),
                category_details=CreateTagRequest(name=tag, description="Tableau Tag"),
            )
            yield tag_category
            logger.info(
                f"Tag Category {TABLEAU_TAG_CATEGORY}, Primary Tag {tag} Ingested"
            )

    def get_tag_labels(self, tags: List[str]) -> Optional[List[TagLabel]]:
        return [
            TagLabel(
                tagFQN=fqn.build(
                    self.metadata,
                    Tag,
                    tag_category_name=TABLEAU_TAG_CATEGORY,
                    tag_name=tag,
                ),
                labelType="Automated",
                state="Suggested",
                source="Tag",
            )
            for tag in tags
        ]

    def yield_dashboard(
        self, dashboard_details: TableauDashboard
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        workbook_url = urlparse(dashboard_details.webpage_url).fragment
        yield CreateDashboardRequest(
            name=dashboard_details.id,
            displayName=dashboard_details.name,
            description=dashboard_details.description,
            owner=self.get_owner_details(dashboard_details),
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            tags=self.get_tag_labels(dashboard_details.tags),
            dashboardUrl=f"#{workbook_url}",
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
        )

    def yield_dashboard_lineage_details(
        self, dashboard_details: TableauDashboard, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """

        data_source = next(
            (
                data_source
                for data_source in self.workbook_datasources or []
                if data_source.get("luid") == dashboard_details.id
            ),
            None,
        )
        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_details.id,
        )
        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )

        try:
            upstream_tables = data_source.get("upstreamTables")
            for upstream_table in upstream_tables:
                database_schema_table = fqn.split_table_name(upstream_table.get("name"))
                from_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=db_service_name,
                    schema_name=database_schema_table.get(
                        "database_schema", upstream_table.get("schema")
                    ),
                    table_name=database_schema_table.get("table"),
                    database_name=database_schema_table.get("database"),
                )
                from_entity = self.metadata.get_by_name(
                    entity=Table,
                    fqn=from_fqn,
                )
                yield self._get_add_lineage_request(
                    to_entity=to_entity, from_entity=from_entity
                )
        except (Exception, IndexError) as err:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {err}"
            )

    def yield_dashboard_chart(
        self, dashboard_details: TableauDashboard
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        for chart in dashboard_details.charts or []:
            try:
                if filter_by_chart(self.source_config.chartFilterPattern, chart.name):
                    self.status.filter(chart.name, "Chart Pattern not allowed")
                    continue
                workbook_name = dashboard_details.name.replace(" ", "")
                site_url = (
                    f"site/{self.service_connection.siteUrl}/"
                    if self.service_connection.siteUrl
                    else ""
                )
                chart_url = (
                    f"#/{site_url}" f"views/{workbook_name}/" f"{chart.view_url_name}"
                )
                yield CreateChartRequest(
                    name=chart.id,
                    displayName=chart.name,
                    chartType=get_standard_chart_type(chart.sheet_type),
                    chartUrl=chart_url,
                    tags=self.get_tag_labels(chart.tags),
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart.id)
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error to yield dashboard chart [{chart}]: {exc}")

    def close(self):
        try:
            self.client.sign_out()
        except ConnectionError as err:
            logger.debug(f"Error closing connection - {err}")
