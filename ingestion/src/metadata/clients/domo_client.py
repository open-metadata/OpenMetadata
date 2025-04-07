#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
DomoClient source to extract data from DOMO
"""

import traceback
from dataclasses import dataclass
from typing import List, Optional, Union

from pydantic import BaseModel, ConfigDict
from pydomo import Domo

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
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

HEADERS = {"Content-Type": "application/json"}
WORKFLOW_URL = "dataprocessing/v1/dataflows"


class DomoBaseModel(BaseModel):
    """
    Domo basic configurations
    """

    model_config = ConfigDict(extra="allow")

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

    cardIds: Optional[List[int]] = None
    collectionIds: Optional[List[int]] = None
    description: Optional[str] = None
    owners: Optional[List[DomoOwner]] = None


class DomoChartMetadataDetails(BaseModel):
    """
    Metadata Details in chart
    """

    model_config = ConfigDict(extra="allow")

    chartType: Optional[str] = None


class DomoChartDetails(DomoBaseModel):
    """
    Response from Domo API for chart
    """

    metadata: DomoChartMetadataDetails
    description: Optional[str] = None


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
        HEADERS.update({"X-DOMO-Developer-Token": self.config.accessToken})
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.instanceDomain),
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
                    id=str(response[0]["id"]),
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

    def test_list_cards(self) -> None:
        """
        Test function to list the cards. Since we are not passing any URNS from the dashboard
        we expect an empty result. However, the call should not fail with any 401 error.
        This helps us validate that the provided Access Token is correct for Domo Dashboard.
        """
        try:
            self.client._request(  # pylint: disable=protected-access
                method="GET", path="content/v1/cards", headers=HEADERS
            )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error listing cards due to [{exc}]")
            raise exc


@dataclass
class OMPyDomoClient:
    """
    domo_client: official pydomo client https://github.com/domoinc/domo-python-sdk
    client: custom requests on the instance domain
    """

    domo: Domo
    custom: DomoClient
