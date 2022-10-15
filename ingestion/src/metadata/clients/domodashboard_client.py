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
DomoDashboard Client source to extract DOMO metadata
"""

from typing import List

from metadata.generated.schema.entity.services.connections.dashboard.domodashboardConnection import (
    DomoDashboardConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig

CARDS_URL = (
    "cards?includeV4PageLayouts=true&parts=metadata,datasources,library,drillPathURNs"
    ",owners,certification,dateInfo,subscriptions,slicers"
)


HEADERS = {"Content-Type": "application/json"}


class DomoDashboardClient:
    """
    Implements the necessary methods to extract
    Dashboard metadata from Domo's metadata db
    """

    def __init__(self, config: DomoDashboardConnection):
        self.config = config
        HEADERS.update({"X-DOMO-Developer-Token": self.config.accessToken})
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.sandboxDomain,
            api_version="api/content/v3/",
            auth_header="Authorization",
            auth_token=lambda: ("no_token", 0),
        )
        self.client = REST(client_config)

    def get_chart_details(self, page_id) -> List[dict]:
        url = (
            f"stacks/{page_id}/"
            f"{CARDS_URL}"
            f"&stackLoadContext=Page&stackLoadContextId={page_id}&stackLoadTrigger=page-view"
        )
        response = self.client._request(  # pylint: disable=protected-access
            method="GET", path=url, headers=HEADERS
        )
        return response
