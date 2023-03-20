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
Redash source module
"""
import traceback
from typing import Iterable, List, Optional

from packaging import version

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as LineageDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.redashConnection import (
    RedashConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.lineage.parser import LineageParser
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

REDASH_TAG_CATEGORY = "RedashTags"

INCOMPATIBLE_REDASH_VERSION = "8.0.0"


class RedashSource(DashboardServiceSource):
    """
    Redash Source Class
    """

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):

        super().__init__(config, metadata_config)
        self.dashboard_list = []  # We will populate this in `prepare`
        self.tags = []  # To create the tags before yielding final entities

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedashConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedashConnection):
            raise InvalidSourceException(
                f"Expected RedashConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def prepare(self):
        """
        Fetch the paginated list of dashboards and tags
        """

        self.dashboard_list = self.client.paginate(self.client.dashboards)

        # Collecting all the tags
        for dashboard in self.dashboard_list:
            self.tags.extend(dashboard.get("tags") or [])

    def yield_tag(self, *_, **__) -> OMetaTagAndClassification:
        """
        Fetch Dashboard Tags
        """
        for tag in self.tags:
            try:
                classification = OMetaTagAndClassification(
                    classification_request=CreateClassificationRequest(
                        name=REDASH_TAG_CATEGORY,
                        description="Tags associates with redash entities",
                    ),
                    tag_request=CreateTagRequest(
                        classification=REDASH_TAG_CATEGORY,
                        name=tag,
                        description="Redash Tag",
                    ),
                )
                yield classification
                logger.info(f"Classification {REDASH_TAG_CATEGORY}, Tag {tag} Ingested")
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error ingesting tag {tag}: {exc}")

    def get_tag_labels(self, tags: Optional[List[str]]) -> Optional[List[TagLabel]]:
        if tags:
            return [
                TagLabel(
                    tagFQN=fqn.build(
                        self.metadata,
                        Tag,
                        classification_name=REDASH_TAG_CATEGORY,
                        tag_name=tag,
                    ),
                    labelType=LabelType.Automated.value,
                    state=State.Suggested.value,
                    source=TagSource.Classification.value,
                )
                for tag in tags
            ]
        return None

    def get_dashboards_list(self) -> Optional[List[dict]]:
        """
        Get List of all dashboards
        """

        return self.dashboard_list

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["name"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return self.client.get_dashboard(dashboard["slug"])

    def get_owner_details(self, dashboard_details) -> Optional[EntityReference]:
        """Get dashboard owner

        Args:
            dashboard_details:
        Returns:
            Optional[EntityReference]
        """
        if dashboard_details.get("user") and dashboard_details["user"].get("email"):
            user = self.metadata.get_user_by_email(
                dashboard_details["user"].get("email")
            )
            if user:
                return EntityReference(id=user.id.__root__, type="user")
        return None

    def get_dashboard_url(self, dashboard_details: dict) -> str:
        if version.parse(self.service_connection.redashVersion) > version.parse(
            INCOMPATIBLE_REDASH_VERSION
        ):
            dashboard_url = f"/dashboards/{dashboard_details.get('id', '')}"
        else:
            dashboard_url = f"/dashboards/{dashboard_details.get('slug', '')}"
        return dashboard_url

    def yield_dashboard(
        self, dashboard_details: dict
    ) -> Iterable[CreateDashboardRequest]:
        """
        Method to Get Dashboard Entity
        """
        try:
            dashboard_description = ""
            for widgets in dashboard_details.get("widgets") or []:
                dashboard_description = widgets.get("text")

            dashboard_request = CreateDashboardRequest(
                name=dashboard_details["id"],
                displayName=dashboard_details.get("name"),
                description=dashboard_description,
                charts=[
                    fqn.build(
                        self.metadata,
                        entity_type=Chart,
                        service_name=self.context.dashboard_service.fullyQualifiedName.__root__,
                        chart_name=chart.name.__root__,
                    )
                    for chart in self.context.charts
                ],
                service=self.context.dashboard_service.fullyQualifiedName.__root__,
                dashboardUrl=self.get_dashboard_url(dashboard_details),
                tags=self.get_tag_labels(dashboard_details.get("tags")),
            )
            yield dashboard_request
            self.register_record(dashboard_request=dashboard_request)

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error to yield dashboard for {dashboard_details}: {exc}")

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        In redash we do not get table, database_schema or database name but we do get query
        the lineage is being generated based on the query
        """

        to_fqn = fqn.build(
            self.metadata,
            entity_type=LineageDashboard,
            service_name=self.config.serviceName,
            dashboard_name=str(dashboard_details.get("id")),
        )
        to_entity = self.metadata.get_by_name(
            entity=LineageDashboard,
            fqn=to_fqn,
        )
        for widgets in dashboard_details.get("widgets") or []:
            try:
                visualization = widgets.get("visualization")
                if not visualization:
                    continue
                if visualization.get("query", {}).get("query"):
                    lineage_parser = LineageParser(visualization["query"]["query"])
                    for table in lineage_parser.source_tables:
                        table_name = str(table)
                        database_schema_table = fqn.split_table_name(table_name)
                        from_fqn = fqn.build(
                            self.metadata,
                            entity_type=Table,
                            service_name=db_service_name,
                            schema_name=database_schema_table.get("database_schema"),
                            table_name=database_schema_table.get("table"),
                            database_name=database_schema_table.get("database"),
                        )
                        from_entity = self.metadata.get_by_name(
                            entity=Table,
                            fqn=from_fqn,
                        )
                        if from_entity and to_entity:
                            yield self._get_add_lineage_request(
                                to_entity=to_entity, from_entity=from_entity
                            )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}"
                )

    def yield_dashboard_chart(
        self, dashboard_details: dict
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Metod to fetch charts linked to dashboard
        """
        for widgets in dashboard_details.get("widgets") or []:
            try:
                visualization = widgets.get("visualization")
                chart_display_name = str(
                    visualization["query"]["name"] if visualization else widgets["id"]
                )
                if filter_by_chart(
                    self.source_config.chartFilterPattern, chart_display_name
                ):
                    self.status.filter(chart_display_name, "Chart Pattern not allowed")
                    continue
                yield CreateChartRequest(
                    name=widgets["id"],
                    displayName=chart_display_name
                    if visualization and visualization["query"]
                    else "",
                    chartType=get_standard_chart_type(
                        visualization["type"] if visualization else ""
                    ),
                    service=self.context.dashboard_service.fullyQualifiedName.__root__,
                    chartUrl=self.get_dashboard_url(dashboard_details),
                    description=visualization["description"] if visualization else "",
                )
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error to yield dashboard chart for widget_id: {widgets['id']} and {dashboard_details}: {exc}"
                )
