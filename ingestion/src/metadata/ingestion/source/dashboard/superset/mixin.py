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
from typing import List

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
