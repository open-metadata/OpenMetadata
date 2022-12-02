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
Looker source module.
Supports:
- owner
- lineage
- usage

Notes:
- Filtering is applied on the Dashboard title or ID, if the title is missing
"""

import traceback
from datetime import datetime
from typing import Iterable, List, Optional, Set, cast

from looker_sdk.error import SDKError
from looker_sdk.sdk.api31.models import Query
from looker_sdk.sdk.api40.methods import Looker40SDK
from looker_sdk.sdk.api40.models import Dashboard as LookerDashboard
from looker_sdk.sdk.api40.models import (
    DashboardBase,
    DashboardElement,
    LookmlModelExplore,
)

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as MetadataDashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LookerConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.dashboard.dashboard_service import (
    DashboardServiceSource,
    DashboardUsage,
)
from metadata.utils import fqn
from metadata.utils.filters import filter_by_chart
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


LIST_DASHBOARD_FIELDS = ["id", "title"]

# Here we can update the fields to get further information, such as:
# created_at, updated_at, last_updater_id, deleted_at, deleter_id, favorite_count, last_viewed_at
GET_DASHBOARD_FIELDS = [
    "id",
    "title",
    "dashboard_elements",
    "dashboard_filters",
    "view_count",
    "description",
    "folder",
    "user_id",  # Use as owner
]


class LookerSource(DashboardServiceSource):
    """
    Looker Source Class.

    Its client uses Looker 40 from the SDK: client = looker_sdk.init40()
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    client: Looker40SDK

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.today = datetime.now().strftime("%Y-%m-%d")

        # Owners cache. The key will be the user_id and the value its OM user EntityRef
        self._owners_ref = {}

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: LookerConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, LookerConnection):
            raise InvalidSourceException(
                f"Expected LookerConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboards_list(self) -> List[DashboardBase]:
        """
        Get List of all dashboards
        """
        try:
            return list(
                self.client.all_dashboards(fields=",".join(LIST_DASHBOARD_FIELDS))
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Wild error trying to obtain dashboard list {err}")
            # If we cannot list the dashboards, let's blow up
            raise err

    def get_dashboard_name(self, dashboard: DashboardBase) -> str:
        """
        Get Dashboard Title. This will be used for filtering.
        If the title is not present, we'll send the ID
        """
        return dashboard.title or dashboard.id

    def get_dashboard_details(self, dashboard: DashboardBase) -> LookerDashboard:
        """
        Get Dashboard Details
        """
        return self.client.dashboard(
            dashboard_id=dashboard.id, fields=",".join(GET_DASHBOARD_FIELDS)
        )

    def get_owner_details(
        self, dashboard_details: LookerDashboard
    ) -> Optional[EntityReference]:
        """Get dashboard owner

        Store the visited users in the _owners_ref cache, even if we found them
        in OM or not.

        If the user has not yet been visited, store it and return from cache.

        Args:
            dashboard_details: LookerDashboard
        Returns:
            Optional[EntityReference]
        """

        try:
            if (
                dashboard_details.user_id is not None
                and dashboard_details.user_id not in self._owners_ref
            ):
                dashboard_owner = self.client.user(dashboard_details.user_id)
                user = self.metadata.get_user_by_email(dashboard_owner.email)
                if user:  # Save the EntityRef
                    self._owners_ref[dashboard_details.user_id] = EntityReference(
                        id=user.id, type="user"
                    )
                else:  # Otherwise, flag the user as missing in OM
                    self._owners_ref[dashboard_details.user_id] = None
                    logger.debug(
                        f"User {dashboard_owner.email} not found in OpenMetadata."
                    )

        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner data due to {err}")

        return self._owners_ref.get(dashboard_details.user_id)

    def yield_dashboard(
        self, dashboard_details: LookerDashboard
    ) -> CreateDashboardRequest:
        """
        Method to Get Dashboard Entity
        """

        yield CreateDashboardRequest(
            name=dashboard_details.id.replace("::", "_"),
            displayName=dashboard_details.title,
            description=dashboard_details.description or None,
            charts=[
                EntityReference(id=chart.id.__root__, type="chart")
                for chart in self.context.charts
            ],
            dashboardUrl=f"/dashboards/{dashboard_details.id}",
            service=EntityReference(
                id=self.context.dashboard_service.id.__root__, type="dashboardService"
            ),
            owner=self.get_owner_details(dashboard_details),
        )

    @staticmethod
    def _clean_table_name(table_name: str) -> str:
        """
        sql_table_names might be renamed when defining
        an explore. E.g., customers as cust
        :param table_name: explore table name
        :return: clean table name
        """

        return table_name.lower().split("as")[0].strip()

    def _add_sql_table(self, query: Query, dashboard_sources: Set[str]):
        """
        Add the SQL table information to the dashboard_sources.

        Updates the seen dashboards.

        :param query: Looker query, from a look or result_maker
        :param dashboard_sources: seen tables so far
        """
        try:
            explore: LookmlModelExplore = self.client.lookml_model_explore(
                query.model, query.view
            )
            table_name = explore.sql_table_name

            if table_name:
                dashboard_sources.add(self._clean_table_name(table_name))

        except SDKError as err:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Cannot get explore from model={query.model}, view={query.view}: {err}"
            )

    def get_dashboard_sources(self, dashboard_details: LookerDashboard) -> Set[str]:
        """
        Set of source tables to build lineage for the processed dashboard
        """
        dashboard_sources: Set[str] = set()

        for chart in cast(
            Iterable[DashboardElement], dashboard_details.dashboard_elements
        ):
            if chart.query and chart.query.view:
                self._add_sql_table(chart.query, dashboard_sources)
            if chart.look and chart.look.query and chart.look.query.view:
                self._add_sql_table(chart.look.query, dashboard_sources)
            if (
                chart.result_maker
                and chart.result_maker.query
                and chart.result_maker.query.view
            ):
                self._add_sql_table(chart.result_maker.query, dashboard_sources)

        return dashboard_sources

    def yield_dashboard_lineage_details(
        self, dashboard_details: LookerDashboard, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between charts and data sources.

        We look at:
        - chart.query
        - chart.look (chart.look.query)
        - chart.result_maker
        """
        datasource_list = self.get_dashboard_sources(dashboard_details)

        to_fqn = fqn.build(
            self.metadata,
            entity_type=MetadataDashboard,
            service_name=self.config.serviceName,
            dashboard_name=dashboard_details.id.replace("::", "_"),
        )
        to_entity = self.metadata.get_by_name(
            entity=MetadataDashboard,
            fqn=to_fqn,
        )

        for source in datasource_list:
            try:
                yield self.build_lineage_request(
                    source=source,
                    db_service_name=db_service_name,
                    to_entity=to_entity,
                )

            except (Exception, IndexError) as err:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Error building lineage for database service [{db_service_name}]: {err}"
                )

    def build_lineage_request(
        self, source: str, db_service_name: str, to_entity: MetadataDashboard
    ) -> Optional[AddLineageRequest]:
        """
        Once we have a list of origin data sources, check their components
        and build the lineage request.

        We will try searching in ES with and without the `database`

        Args:
            source: table name from the source list
            db_service_name: name of the service from the config
            to_entity: Dashboard Entity being used
        """

        source_elements = fqn.split_table_name(table_name=source)

        for database_name in [source_elements["database"], None]:

            from_fqn = fqn.build(
                self.metadata,
                entity_type=Table,
                service_name=db_service_name,
                database_name=database_name,
                schema_name=source_elements["database_schema"],
                table_name=source_elements["table"],
            )

            from_entity: Table = self.metadata.get_by_name(
                entity=Table,
                fqn=from_fqn,
            )

            if from_entity:
                return self._get_add_lineage_request(
                    to_entity=to_entity, from_entity=from_entity
                )

        return None

    def yield_dashboard_chart(
        self, dashboard_details: LookerDashboard
    ) -> Optional[Iterable[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """
        for chart in dashboard_details.dashboard_elements:
            try:
                if filter_by_chart(
                    chart_filter_pattern=self.source_config.chartFilterPattern,
                    chart_name=chart.id,
                ):
                    self.status.filter(chart.id, "Chart filtered out")
                    continue

                if not chart.id:
                    logger.debug(f"Found chart {chart} without id. Skipping.")
                    continue

                yield CreateChartRequest(
                    name=chart.id,
                    displayName=chart.title or chart.id,
                    description=self.build_chart_description(chart) or None,
                    chartType=get_standard_chart_type(chart.type).value,
                    chartUrl=f"/dashboard_elements/{chart.id}",
                    service=EntityReference(
                        id=self.context.dashboard_service.id.__root__,
                        type="dashboardService",
                    ),
                )
                self.status.scanned(chart.id)

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error creating chart [{chart}]: {exc}")

    @staticmethod
    def build_chart_description(chart: DashboardElement) -> Optional[str]:
        """
        Chart descriptions will be based on the subtitle + note_text, if exists.
        If the chart is a text tile, we will add the text as the chart description as well.
        This should keep the dashboard searchable without breaking the original metadata structure.
        """

        # If the string is None or empty, filter it out.
        try:
            return "; ".join(
                filter(
                    lambda string: string,
                    [chart.subtitle_text, chart.body_text, chart.note_text],
                )
                or []
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"Error getting chart description: {err}")
            return None

    def yield_dashboard_usage(  # pylint: disable=W0221
        self, dashboard_details: LookerDashboard
    ) -> Optional[DashboardUsage]:
        """
        The dashboard.view_count gives us the total number of views. However, we need to
        pass the views for each day (execution).

        In this function we will first validate if the usageSummary
        returns us some usage for today's date. If so, we will stop the
        execution.

        Otherwise, we will add the difference between the usage from the last time
        the usage was reported and today's view_count from the dashboard.

        Example usage summary from OM API:
        "usageSummary": {
            "dailyStats": {
                "count": 51,
                "percentileRank": 0.0
            },
            "date": "2022-06-23",
            "monthlyStats": {
                "count": 105,
                "percentileRank": 0.0
            },
            "weeklyStats": {
                "count": 105,
                "percentileRank": 0.0
            }
        },
        :param dashboard_details: Looker Dashboard
        :return: UsageRequest, if not computed
        """

        dashboard: MetadataDashboard = self.context.dashboard

        try:
            current_views = dashboard_details.view_count

            if not current_views:
                logger.debug(f"No usage to report for {dashboard_details.title}")

            if not dashboard.usageSummary:
                logger.info(
                    f"Yielding fresh usage for {dashboard.fullyQualifiedName.__root__}"
                )
                yield DashboardUsage(
                    dashboard=dashboard,
                    usage=UsageRequest(date=self.today, count=current_views),
                )

            elif (
                str(dashboard.usageSummary.date.__root__) != self.today
                or not dashboard.usageSummary.dailyStats.count
            ):

                latest_usage = dashboard.usageSummary.dailyStats.count

                new_usage = current_views - latest_usage
                if new_usage < 0:
                    raise ValueError(
                        f"Wrong computation of usage difference. Got new_usage={new_usage}."
                    )

                logger.info(
                    f"Yielding new usage for {dashboard.fullyQualifiedName.__root__}"
                )
                yield DashboardUsage(
                    dashboard=dashboard,
                    usage=UsageRequest(
                        date=self.today, count=current_views - latest_usage
                    ),
                )

            else:
                logger.debug(
                    f"Latest usage {dashboard.usageSummary} vs. today {self.today}. Nothing to compute."
                )
                logger.info(
                    f"Usage already informed for {dashboard.fullyQualifiedName.__root__}"
                )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Exception computing dashboard usage for {dashboard.fullyQualifiedName.__root__}: {exc}"
            )
