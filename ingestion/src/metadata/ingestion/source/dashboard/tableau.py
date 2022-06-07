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
from typing import Iterable, List, Optional, Union

import dateutil.parser as dateparser
from tableau_api_lib.utils.querying import (
    get_views_dataframe,
    get_workbook_connections_dataframe,
    get_workbooks_dataframe,
)

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
from metadata.ingestion.source.dashboard.dashboard_source import DashboardSourceService
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_chart_entities_from_id, get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
TABLEAU_TAG_CATEGORY = "TableauTags"


class TableauSource(DashboardSourceService):
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
        self.dashboards = get_workbooks_dataframe(self.client).to_dict()
        self.all_dashboard_details = get_views_dataframe(self.client).to_dict()

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
        dashboards = [{} for _ in range(len(self.dashboards["id"]))]
        for key, obj_dicts in self.dashboards.items():
            for index, value in obj_dicts.items():
                dashboards[int(index)][key] = value
        return dashboards

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

    def get_dashboard_owner(self, owner: dict) -> Optional[EntityReference]:
        """Get dashboard owner

        Args:
            owner:
        Returns:
            List[DashboardOwner]
        """
        try:
            user_request = CreateUserRequest(
                name=owner["name"], displayName=owner["fullName"], email=owner["email"]
            )
            created_user: User = self.metadata.create_or_update(user_request)
            return EntityReference(
                id=created_user.id.__root__,
                type="user",
            )
        except Exception as err:
            logger.error(err)

    def create_tags(self, entity_tags: dict) -> OMetaTagAndCategory:
        """
        Fetch Dashboard Tags
        """
        if entity_tags.get("tag"):
            for tag in entity_tags["tag"]:
                tag_category = OMetaTagAndCategory(
                    category_name=CreateTagCategoryRequest(
                        name=TABLEAU_TAG_CATEGORY,
                        description="Tags associates with amundsen entities",
                        categoryType="Descriptive",
                    ),
                    category_details=CreateTagRequest(
                        name=tag["label"], description="Amundsen Table Tag"
                    ),
                )
                yield tag_category
            logger.info(f"Tag Category {tag_category}, Primary Tag {tag} Ingested")

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

    def get_dashboard_entity(
        self, dashboard_details: dict
    ) -> Union[CreateDashboardRequest, Optional[OMetaTagAndCategory]]:
        """
        Method to Get Dashboard Entity
        """
        dashboard_tag = dashboard_details.get("tags")
        yield from self.create_tags(dashboard_tag)
        yield CreateDashboardRequest(
            name=dashboard_details.get("name"),
            displayName=dashboard_details.get("name"),
            description="",
            owner=self.get_dashboard_owner(self.owner),
            charts=get_chart_entities_from_id(
                chart_ids=self.charts,
                metadata=self.metadata,
                service_name=self.config.serviceName,
            ),
            tags=self.get_tag_lables(dashboard_tag),
            dashboardUrl=dashboard_details.get("webpageUrl"),
            service=EntityReference(id=self.service.id, type="dashboardService"),
        )

    def get_lineage(self, dashboard_details: dict) -> Optional[AddLineageRequest]:
        """
        Get lineage between dashboard and data sources
        """
        datasource_list = (
            get_workbook_connections_dataframe(self.client, dashboard_details.get("id"))
            .get("datasource_name")
            .tolist()
        )
        dashboard_name = dashboard_details.get("name")
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

    def fetch_dashboard_charts(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        self.charts = []
        self.chart = None
        self.owner = None
        for index in range(len(self.all_dashboard_details["id"])):
            try:
                self.owner = self.all_dashboard_details["owner"][index]
                self.chart = self.all_dashboard_details["workbook"][index]
                if self.chart["id"] == dashboard_details.get("id"):
                    chart_id = self.all_dashboard_details["id"][index]
                    chart_name = self.all_dashboard_details["name"][index]
                    if filter_by_chart(
                        self.source_config.chartFilterPattern, chart_name
                    ):
                        self.status.failure(chart_name, "Chart Pattern not allowed")
                        continue
                    chart_tags = self.all_dashboard_details["tags"][index]
                    chart_url = (
                        f"{self.service_connection.hostPort}"
                        f"/#/site/{self.service_connection.siteName}/"
                        f"views/{self.all_dashboard_details['workbook'][index]['name']}/"
                        f"{self.all_dashboard_details['viewUrlName'][index]}"
                    )
                    yield from self.create_tags(chart_tags)
                    yield CreateChartRequest(
                        name=chart_id,
                        displayName=chart_name,
                        description="",
                        chartType=get_standard_chart_type(
                            self.all_dashboard_details["sheetType"][index]
                        ),
                        chartUrl=chart_url,
                        owner=self.get_dashboard_owner(
                            self.all_dashboard_details["owner"][index]
                        ),
                        tags=self.get_tag_lables(chart_tags),
                        service=EntityReference(
                            id=self.service.id, type="dashboardService"
                        ),
                    )
                    self.charts.append(chart_id)
                    self.status.scanned(chart_id)
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.error(err)
