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
Superset mixin module
"""
import json
import traceback
from typing import Iterable, List, Optional

from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import (
    Dashboard as Lineage_Dashboard,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.utils import fqn
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SupersetSourceMixin(DashboardServiceSource):
    """
    Superset DB Source Class
    """

    config: WorkflowSource
    metadata_config: OpenMetadataConnection
    status: SourceStatus
    platform = "superset"
    service_type = DashboardServiceType.Superset.value
    service_connection: SupersetConnection

    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.all_charts = {}

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: SupersetConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SupersetConnection):
            raise InvalidSourceException(
                f"Expected SupersetConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def get_dashboard_name(self, dashboard: dict) -> str:
        """
        Get Dashboard Name
        """
        return dashboard["dashboard_title"]

    def get_dashboard_details(self, dashboard: dict) -> dict:
        """
        Get Dashboard Details
        """
        return dashboard

    def _get_user_by_email(self, email: str) -> EntityReference:

        if email:
            user = self.metadata.get_user_by_email(email)
            if user:
                return EntityReference(id=user.id.__root__, type="user")

        return None

    def yield_owner(self, dashboard_details: dict) -> Optional[Lineage_Dashboard]:
        owner = self.get_owner_details(dashboard_details=dashboard_details)
        if owner:
            self.metadata.patch_owner(
                self.metadata,
                entity=Lineage_Dashboard,
                entity_id=self.context.dashboard.id,
                force=self.source_config.overrideOwner,
            )

    def get_owner_details(self, dashboard_details: dict) -> EntityReference:
        for owner in dashboard_details.get("owners", []):
            user = self._get_user_by_email(owner["email"])
            if user:
                return user
        if dashboard_details.get("email"):
            user = self._get_user_by_email(dashboard_details["email"])
            if user:
                return user
        return None

    def _get_charts_of_dashboard(self, dashboard_details: dict) -> List[str]:
        """
        Method to fetch chart ids linked to dashboard
        """
        raw_position_data = dashboard_details.get("position_json", {})
        if raw_position_data:
            position_data = json.loads(raw_position_data)
            return [
                value.get("meta", {}).get("chartId")
                for key, value in position_data.items()
                if key.startswith("CHART-") and value.get("meta", {}).get("chartId")
            ]
        return []

    def yield_dashboard_lineage_details(
        self, dashboard_details: dict, db_service_name: str
    ) -> Optional[Iterable[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """
        for chart_id in self._get_charts_of_dashboard(dashboard_details):
            chart_json = self.all_charts.get(chart_id)
            if chart_json:
                datasource_fqn = self._get_datasource_fqn_for_lineage(
                    chart_json, db_service_name
                )
                if not datasource_fqn:
                    continue
                from_entity = self.metadata.get_by_name(
                    entity=Table,
                    fqn=datasource_fqn,
                )
                try:
                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Lineage_Dashboard,
                        service_name=self.config.serviceName,
                        dashboard_name=str(dashboard_details["id"]),
                    )
                    to_entity = self.metadata.get_by_name(
                        entity=Lineage_Dashboard,
                        fqn=dashboard_fqn,
                    )
                    if from_entity and to_entity:
                        yield self._get_add_lineage_request(
                            to_entity=to_entity, from_entity=from_entity
                        )
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error to yield dashboard lineage details for DB service name [{db_service_name}]: {exc}"
                    )
