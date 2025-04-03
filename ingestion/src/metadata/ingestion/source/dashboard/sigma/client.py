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
REST Auth & Client for Sigma
"""

import traceback
from base64 import b64encode
from typing import List, Optional, Tuple

from metadata.generated.schema.entity.services.connections.dashboard.sigmaConnection import (
    SigmaConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.sigma.models import (
    AuthToken,
    EdgeSourceResponse,
    Elements,
    ElementsResponse,
    NodeDetails,
    OwnerDetails,
    Workbook,
    WorkbookDetails,
    WorkBookPageResponse,
    WorkBookResponseDetails,
)
from metadata.utils.constants import AUTHORIZATION_HEADER, UTF_8
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()

HEADERS = {
    "accept": "application/json",
    "Content-type": "application/x-www-form-urlencoded",
}

TOKEN_PAYLOAD = {"grant_type": "client_credentials"}


class SigmaApiClient:
    """
    REST Auth & Client for Sigma
    """

    client: REST

    def __init__(self, config: SigmaConnection):
        self.config = config
        token_api_key = str(
            b64encode(
                f"{self.config.clientId}:{self.config.clientSecret.get_secret_value()}".encode(
                    UTF_8
                )
            ).decode(UTF_8)
        )

        token_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version=config.apiVersion,
            auth_header=AUTHORIZATION_HEADER,
            extra_headers=HEADERS,
            auth_token=lambda: (token_api_key, 0),
            auth_token_mode="Basic",
        )

        self.token_client = REST(token_config)

        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version=config.apiVersion,
            auth_token=self.get_auth_token,
            auth_header=AUTHORIZATION_HEADER,
        )

        self.client = REST(client_config)

    def get_auth_token(self) -> Tuple[str, int]:
        """
        generate auth token
         Returns:
            Tuple[str, int]: A tuple containing the access_token (str) and expires_in (int)
        """
        result = AuthToken.model_validate(
            self.token_client.post("/auth/token", data=TOKEN_PAYLOAD)
        )
        return result.access_token, result.expires_in

    def test_get_dashboards(self) -> Optional[List[Workbook]]:
        """
        method to test fetch dashboards from api
        """
        result = self.client.get("/workbooks")
        result = WorkBookResponseDetails.model_validate(self.client.get("/workbooks"))
        if result:
            return result.entries

    def get_dashboards(self) -> Optional[List[Workbook]]:
        """
        method to fetch dashboards from api
        """
        workbooks = []
        try:
            result = self.client.get("/workbooks")
            result = WorkBookResponseDetails.model_validate(
                self.client.get("/workbooks")
            )
            if result:
                workbooks.extend(result.entries)
                while result.nextPage:
                    data = {"page": int(result.nextPage)}
                    result = WorkBookResponseDetails.model_validate(
                        self.client.get("/workbooks", data=data)
                    )
                    if result:
                        workbooks.extend(result.entries)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching Dashboards: {exc}")
        return workbooks

    def get_dashboard_detail(self, workbook_id: str) -> Optional[WorkbookDetails]:
        """
        method to fetch dashboard details from api
        """
        try:
            result = WorkbookDetails.model_validate(
                self.client.get(f"/workbooks/{workbook_id}")
            )
            if result:
                return result
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.error(
                f"Error fetching Dashboard details for for workbook {workbook_id}: {exc}"
            )
        return None

    def get_owner_detail(self, owner_id: str) -> Optional[OwnerDetails]:
        """
        method to fetch dashboard owner details from api
        """
        try:
            result = OwnerDetails.model_validate(
                self.client.get(f"/members/{owner_id}")
            )
            if result:
                return result
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch owner details for owner {owner_id}: {exc}")
        return None

    def get_page_elements(
        self, workbook_id: str, page_id: str
    ) -> Optional[List[Elements]]:
        """
        method to fetch dashboards page elements from api
        """
        elements = []
        try:
            result = ElementsResponse.model_validate(
                self.client.get(f"/workbooks/{workbook_id}/pages/{page_id}/elements")
            )
            if result:
                elements.extend(result.entries)
                while result.nextPage:
                    data = {"page": int(result.nextPage)}
                    result = ElementsResponse.model_validate(
                        self.client.get(
                            f"/workbooks/{workbook_id}/pages/{page_id}/elements",
                            data=data,
                        )
                    )
                    if result:
                        elements.extend(result.entries)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch page elements for workbook {workbook_id}: {exc}"
            )
        return elements

    def get_chart_details(self, workbook_id: str) -> Optional[List[Elements]]:
        """
        method to fetch dashboards chart details from api
        """
        try:
            elements_list = []
            pages = WorkBookPageResponse.model_validate(
                self.client.get(f"/workbooks/{workbook_id}/pages")
            )
            if not pages.entries:
                return None
            while pages.nextPage:
                pages = WorkBookPageResponse.model_validate(
                    self.client.get(
                        f"/workbooks/{workbook_id}/pages",
                        data={"page": int(pages.nextPage)},
                    )
                )
                if not pages.entries:
                    break
                for page in pages.entries:
                    elements_list.extend(
                        self.get_page_elements(workbook_id, page.pageId)
                    )
            return elements_list
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch chart details for workbook {workbook_id}: {exc}"
            )
        return None

    def get_lineage_details(
        self, workbook_id: str, element_id: str
    ) -> Optional[List[NodeDetails]]:
        """
        method to fetch dashboards lineage details from api
        """
        try:
            source_nodes = []
            edges_response = EdgeSourceResponse.model_validate(
                self.client.get(
                    f"/workbooks/{workbook_id}/lineage/elements/{element_id}"
                )
            )
            for node in edges_response.edges:
                if node.node_id:
                    node_details = NodeDetails.model_validate(
                        self.client.get(f"/files/{node.node_id}")
                    )
                    source_nodes.append(node_details)
            return source_nodes
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch lineage details for workbook {workbook_id}: {exc}"
            )
        return None
