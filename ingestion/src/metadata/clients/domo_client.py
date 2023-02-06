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
DomoClient source to extract data from DOMO
"""

import traceback
from typing import List, Optional, Union

from pydantic import BaseModel, Extra

from metadata.generated.schema.entity.services.connections.dashboard.domoDashboardConnection import (
    DomoDashboardConnection,
)
from metadata.generated.schema.entity.services.connections.database.domoDatabaseConnection import (
    DomoDatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.pipeline.domoPipelineConnection import (
    DomoPipelineConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

HEADERS = {"Content-Type": "application/json"}
WORKFLOW_URL = "dataprocessing/v1/dataflows"


class DomoBaseModel(BaseModel):
    """
    Domo basic configurations
    """

    class Config:
        extra = Extra.allow

    id: str
    name: str


class DomoOwner(BaseModel):
    """
    Owner Owner Details
    """

    displayName: str
    id: str


class DomoDashboardDetails(DomoBaseModel):
    """
    Response from Domo API
    """

    cardIds: Optional[List[int]]
    collectionIds: Optional[List[int]]
    description: Optional[str]
    owners: Optional[List[DomoOwner]]


class DomoChartMetadataDetails(BaseModel):
    """
    Metadata Details in chart
    """

    class Config:
        extra = Extra.allow

    chartType: Optional[str]


class DomoChartDetails(DomoBaseModel):
    """
    Response from Domo API for chart
    """

    metadata: DomoChartMetadataDetails
    description: Optional[str]


class DomoClient:
    """
    Implements the necessary methods to extract
    DOMO metadata from Domo's metadata db
    """

    def __init__(
        self,
        config: Union[
            DomoDashboardConnection, DomoPipelineConnection, DomoDatabaseConnection
        ],
    ):
        self.config = config
        self.config.sandboxDomain = (
            self.config.sandboxDomain[:-1]
            if self.config.sandboxDomain.endswith("/")
            else self.config.sandboxDomain
        )
        HEADERS.update({"X-DOMO-Developer-Token": self.config.accessToken})
        client_config: ClientConfig = ClientConfig(
            base_url=self.config.sandboxDomain,
            api_version="api/",
            auth_header="Authorization",
            auth_token=lambda: ("no_token", 0),
        )
        self.client = REST(client_config)

    def get_chart_details(self, page_id) -> Optional[DomoChartDetails]:
        """
        Getting chart details for particular page
        """
        url = (
            f"content/v1/cards?urns={page_id}&parts=datasources,dateInfo,library,masonData,metadata,"
            f"metadataOverrides,owners,problems,properties,slicers,subscriptions&includeFiltered=true"
        )
        try:
            response = self.client._request(  # pylint: disable=protected-access
                method="GET", path=url, headers=HEADERS
            )

            if isinstance(response, list) and len(response) > 0:
                return DomoChartDetails(
                    id=response[0]["id"],
                    name=response[0]["title"],
                    metadata=DomoChartMetadataDetails(
                        chartType=response[0].get("metadata", {}).get("chartType", "")
                    ),
                    description=response[0].get("description", ""),
                )

        except Exception as exc:
            logger.warning(f"Error while getting details for Card {page_id} - {exc}")
            logger.debug(traceback.format_exc())

        return None

    # def get_owner_details(self, owner_id) -> dict:

    def get_pipelines(self):
        try:
            response = self.client._request(  # pylint: disable=protected-access
                method="GET", path=WORKFLOW_URL, headers=HEADERS
            )
            return response
        except Exception as exc:
            logger.warning(f"Error while getting pipelines - {exc}")
            logger.debug(traceback.format_exc())
        return []

    def get_runs(self, workflow_id):
        try:
            url = f"dataprocessing/v1/dataflows/{workflow_id}/executions?limit=100&offset=0"
            response = self.client._request(  # pylint: disable=protected-access
                method="GET", path=url, headers=HEADERS
            )
            return response
        except Exception as exc:
            logger.warning(
                f"Error while getting runs for pipeline {workflow_id} - {exc}"
            )
            logger.debug(traceback.format_exc())
        return []
