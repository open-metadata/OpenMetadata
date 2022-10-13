from typing import List

from metadata.generated.schema.entity.services.connections.dashboard.domodashboardConnection import (
    DomoDashboardConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig

CARDS_URL = "cards?includeV4PageLayouts=true&parts=metadata,datasources,library,drillPathURNs,owners,certification,dateInfo,subscriptions,slicers"

HEADERS = {"Content-Type": "application/json"}


class DomoDashboardClient:
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
        response = self.client._request(method="GET", path=url, headers=HEADERS)
        return response
