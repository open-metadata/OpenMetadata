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
import traceback
from typing import Iterable, List, Optional

from requests.utils import urlparse
from tableau_api_lib.utils.querying import (
    get_views_dataframe,
    get_workbook_connections_dataframe,
    get_workbooks_dataframe,
)
from tableau_api_lib.utils.querying.users import get_all_user_fields

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.tags.createTag import CreateTagRequest
from metadata.generated.schema.api.tags.createTagCategory import (
    CreateTagCategoryRequest,
)
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
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
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.models.ometa_tag_category import OMetaTagAndCategory
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_chart_entities_from_id, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
TABLEAU_TAG_CATEGORY = "TableauTags"


class TableauSource(DashboardServiceSource):
    """Tableau source entity class

    Args:
        config:
        metadata_config:

    Attributes:
        config:
        metadata_config:
        all_dashboard_details:
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
        self.workbooks = {}
        self.tags = []
        self.owner = {}

    def prepare(self):
        # Restructuring the api response for workbooks
        workbook_details = get_workbooks_dataframe(self.client).to_dict()
        for i in range(len(workbook_details.get("id"))):
            workbook = {
                key: workbook_details[key][i] for key in workbook_details.keys()
            }
            workbook["charts"] = []
            self.workbooks[workbook_details["id"][i]] = workbook

        # Restructuring the api response for views and attaching views to their respective workbooks
        all_views_details = get_views_dataframe(self.client).to_dict()
        for i in range(len(all_views_details.get("id"))):
            chart = {
                key: all_views_details[key][i]
                for key in all_views_details.keys()
                if key != "workbook"
            }
            self.workbooks[all_views_details["workbook"][i]["id"]]["charts"].append(
                chart
            )

        # Collecting all view & workbook tags
        for _, tags in workbook_details.get("tags").items():
            self.tags.extend([tag["label"] for tag in tags.get("tag", [])])

        for _, tags in all_views_details.get("tags").items():
            self.tags.extend([tag["label"] for tag in tags.get("tag", [])])

        # Fetch User/Owner Details
        owner = get_all_user_fields(self.client)
        self.owner = {user["id"]: user for user in owner}

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

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """
        return self.workbooks.values()

    def get_dashboard_name(self, dashboard_details: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard_details.get("name")

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def yield_owner(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateUserRequest]]:
        """Get dashboard owner

        Args:
            dashboard_details:
        Returns:
            Optional[EntityReference]
        """
        owner = self.owner[dashboard_details["owner"]["id"]]
        name = owner.get("name")
        displayName = owner.get("fullName")
        email = owner.get("email")
        if name and email:
            yield CreateUserRequest(name=name, displayName=displayName, email=email)

    def yield_tag(self, _) -> OMetaTagAndCategory:
        """
        Fetch Dashboard Tags
        """
        for tag in self.tags:
            tag_category = OMetaTagAndCategory(
                category_name=CreateTagCategoryRequest(
                    name=TABLEAU_TAG_CATEGORY,
                    description="Tags associates with tableau entities",
                    categoryType="Descriptive",
                ),
                category_details=CreateTagRequest(name=tag, description="Tableau Tag"),
            )
            yield tag_category
            logger.info(
                f"Tag Category {TABLEAU_TAG_CATEGORY}, Primary Tag {tag} Ingested"
            )

    def get_tag_lables(self, tags: dict) -> Optional[List[TagLabel]]:
        if tags.get("tag"):
            return [
                TagLabel(
                    tagFQN=fqn.build(
                        self.metadata,
                        Tag,
                        tag_category_name=TABLEAU_TAG_CATEGORY,
                        tag_name=tag["label"],
                    ),
                    labelType="Automated",
                    state="Suggested",
                    source="Tag",
                )
                for tag in tags["tag"]
            ]
        return []

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_tag = dashboard_details.get("tags")
        workbook_url = urlparse(dashboard_details.get("webpageUrl")).fragment
        dashboard_url = f"#{workbook_url}"
        yield CreateDashboardRequest(
            name=dashboard_details.get("id"),
            displayName=dashboard_details.get("name"),
            description="",
            owner=self.context.owner,
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            tags=self.get_tag_lables(dashboard_tag),
            dashboardUrl=dashboard_url,
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
        )

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        datasource_list = (
            get_workbook_connections_dataframe(self.client, dashboard_details.get("id"))
            .get("datasource_name")
            .tolist()
        )
        dashboard_name = dashboard_details.get("name")

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

        for datasource in datasource_list:
            try:
                schema_and_table_name = (
                    datasource.split("(")[1].split(")")[0].split(".")
                )
                schema_name = schema_and_table_name[0]
                table_name = schema_and_table_name[1]
                from_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.source_config.dbServiceName,
                    schema_name=schema_name,
                    table_name=table_name,
                    database_name=None,
                )
                from_entity = self.metadata.get_by_name(
                    entity=Table,
                    fqn=from_fqn,
                )
                if from_entity and to_entity:
                    lineage = AddLineageRequest(
                        edge=EntitiesEdge(
                            fromEntity=EntityReference(
                                id=from_entity.id.__root__, type="table"
                            ),
                            toEntity=EntityReference(
                                id=to_entity.id.__root__, type="dashboard"
                            ),
                        )
                    )
                    yield lineage
            except (Exception, IndexError) as err:
                logger.debug(traceback.format_exc())
                logger.error(err)

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        for chart in dashboard_details.get("charts"):
            try:
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart["name"]
                ):
                    self.status.failure(chart["name"], "Chart Pattern not allowed")
                    continue
                workbook_name = dashboard_details["name"].replace(" ", "")
                site_url = (
                    f"site/{self.service_connection.siteUrl}/"
                    if self.service_connection.siteUrl
                    else ""
                )
                chart_url = (
                    f"#/{site_url}" f"views/{workbook_name}/" f"{chart['viewUrlName']}"
                )
                yield CreateChartRequest(
                    name=chart["id"],
                    displayName=chart["name"],
                    description="",
                    chartType=get_standard_chart_type(chart["sheetType"]),
                    chartUrl=chart_url,
                    tags=self.get_tag_lables(chart["tags"]),
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart["id"])
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)

    def close(self):
        self.client.sign_out()
