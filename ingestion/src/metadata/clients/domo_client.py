"""
DomoClient source to extract data from DOMO
"""

from typing import List, Union

from metadata.generated.schema.entity.services.connections.dashboard.domodashboardConnection import (
    DomoDashboardConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.domopipelineConnection import (
    DomoPipelineConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig

CARDS_URL = "cards?includeV4PageLayouts=true&parts=metadata,datasources,library,drillPathURNs,owners,certification,dateInfo,subscriptions,slicers"  # pylint: disable=line-too-long

HEADERS = {"Content-Type": "application/json"}
WORKFLOW_URL = "dataprocessing/v1/dataflows"


class DomoClient:
    """
    Implements the necessary methods to extract
    DOMO metadata from Domo's metadata db
    """

    def __init__(self, config: Union[DomoDashboardConnection, DomoPipelineConnection]):
        self.config = config
        HEADERS.update({"X-DOMO-Developer-Token": self.config.accessToken})
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.sandboxDomain,
            api_version="api/",
            auth_header="Authorization",
            auth_token=lambda: ("no_token", 0),
        )
        self.client = REST(client_config)

    def get_chart_details(self, page_id) -> List[dict]:
        url = (
            f"content/v3/stacks/{page_id}/"
            f"{CARDS_URL}"
            f"&stackLoadContext=Page&stackLoadContextId={page_id}&stackLoadTrigger=page-view"
        )
        response = self.client._request(
            method="GET", path=url, headers=HEADERS
        )  # pylint: disable=protected-access
        return response

    def get_pipelines(self):
        response = self.client._request(  # pylint: disable=protected-access
            method="GET", path=WORKFLOW_URL, headers=HEADERS
        )
        return response

    def get_runs(self, workflow_id):
        url = f"dataprocessing/v1/dataflows/{workflow_id}/executions?limit=100&offset=0"
        response = self.client._request(
            method="GET", path=url, headers=HEADERS
        )  # pylint: disable=protected-access
        return response
