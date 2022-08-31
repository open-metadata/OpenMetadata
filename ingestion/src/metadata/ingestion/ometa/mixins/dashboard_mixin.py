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
Mixin class containing Table specific methods

To be used by OpenMetadata class
"""

from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


class OMetaDashboardMixin:
    """
    OpenMetadata API methods related to Dashboards and Charts.

    To be inherited by OpenMetadata
    """

    client: REST

    def publish_dashboard_usage(
        self, dashboard: Dashboard, dashboard_usage_request: UsageRequest
    ) -> None:
        """
        POST usage details for a Dashboard

        :param dashboard: Table Entity to update
        :param dashboard_usage_request: Usage data to add
        """
        resp = self.client.put(
            f"/usage/dashboard/{dashboard.id.__root__}",
            data=dashboard_usage_request.json(),
        )
        logger.debug("Published dashboard usage %s", resp)
