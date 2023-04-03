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
REST Auth & Client for PowerBi
"""
import json
import math
import traceback
from time import sleep
from typing import List, Optional, Tuple

import msal

from metadata.generated.schema.entity.utils.powerbiBasicAuthConnection import (
    PowerBIBasicAuthConnection,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.powerbi.models import (
    DashboardsResponse,
    Group,
    GroupsResponse,
    PowerBIDashboard,
    PowerBiToken,
    Tile,
    TilesResponse,
    Workspaces,
    WorkSpaceScanResponse,
)
from metadata.utils.logger import utils_logger

logger = utils_logger()


# Similar inner methods with mode client. That's fine.
# pylint: disable=duplicate-code
class PowerBiApiClient:
    """
    REST Auth & Client for PowerBi
    """

    client: REST

    def __init__(self, config):
        self.config = config
        self.msal_client = self.get_msal_client()
        self.auth_token = self.get_auth_token()
        client_config = ClientConfig(
            base_url="https://api.powerbi.com",
            api_version="v1.0",
            auth_token=lambda: self.auth_token,
            auth_header="Authorization",
            allow_redirects=True,
            retry_codes=[429],
            retry=100,
            retry_wait=30,
        )
        self.client = REST(client_config)

    def get_msal_client(self):
        if isinstance(self.config.powerbiAuthType, PowerBIBasicAuthConnection):
            return msal.PublicClientApplication(
                self.config.clientId,
                authority=self.config.authorityURI + self.config.tenantId,
            )
        return msal.ConfidentialClientApplication(
            client_id=self.config.clientId,
            client_credential=self.config.powerbiAuthType.clientSecret.get_secret_value(),
            authority=self.config.authorityURI + self.config.tenantId,
        )

    def get_auth_token(self) -> Tuple[str, str]:
        """
        Method to generate PowerBi access token
        """
        logger.info("Generating PowerBi access token")

        response_data = self.msal_client.acquire_token_silent(
            scopes=self.config.scope, account=None
        )

        if not response_data:
            logger.info("Token does not exist in the cache. Getting a new token.")
            if isinstance(self.config.powerbiAuthType, PowerBIBasicAuthConnection):
                response_data = self.msal_client.acquire_token_by_username_password(
                    username=self.config.powerbiAuthType.username,
                    password=self.config.powerbiAuthType.password.get_secret_value(),
                    scopes=self.config.scope,
                )
            else:
                response_data = self.msal_client.acquire_token_for_client(
                    scopes=self.config.scope
                )
        auth_response = PowerBiToken(**response_data)
        if not auth_response.access_token:
            raise InvalidSourceException(
                "Failed to generate the PowerBi access token. Please check provided config"
            )

        logger.info("PowerBi Access Token generated successfully")
        return auth_response.access_token, auth_response.expires_in

    def fetch_dashboards(self, admin: bool = True) -> Optional[List[PowerBIDashboard]]:
        """Get dashboards method
        Returns:
            List[PowerBIDashboard]
        """
        try:
            is_admin_api = "admin/" if admin else ""
            response_data = self.client.get(f"/myorg/{is_admin_api}dashboards")
            response = DashboardsResponse(**response_data)
            return response.value

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching dashboards: {exc}")

        return None

    def fetch_charts(self, dashboard_id: str) -> Optional[List[Tile]]:
        """Get charts method
        Returns:
            List[Tile]
        """
        try:
            response_data = self.client.get(f"/myorg/dashboards/{dashboard_id}/tiles")
            response = TilesResponse(**response_data)
            return response.value
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching charts for dashboard_id - {dashboard_id}: {exc}"
            )

        return None

    def fetch_dataset(self, dataset_id: str) -> Optional[dict]:
        """Get Dataset method
        Returns:
            dict
        """
        try:
            return self.client.get(f"/myorg/datasets/{dataset_id}")
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Error fetching dataset for dataset_id - {dataset_id}: {exc}"
            )

        return None

    def fetch_all_workspaces(self) -> Optional[List[Group]]:
        """Method to fetch all powerbi workspace details
        Returns:
            Group
        """
        try:
            entities_per_page = min(100, self.config.pagination_entity_per_page)
            params_data = {"$top": "1"}
            response_data = self.client.get("/myorg/admin/groups", data=params_data)
            response = GroupsResponse(**response_data)
            count = response.odata_count
            indexes = math.ceil(count / entities_per_page)

            workspaces = []
            for index in range(indexes):
                params_data = {
                    "$top": str(entities_per_page),
                    "$skip": str(index * entities_per_page),
                }
                response_data = self.client.get("/myorg/admin/groups", data=params_data)
                response = GroupsResponse(**response_data)
                workspaces.extend(response.value)
            return workspaces
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching workspaces: {exc}")
        return None

    def initiate_workspace_scan(
        self, workspace_ids: List[str]
    ) -> Optional[WorkSpaceScanResponse]:
        """Method to initiate workspace scan
        Args:
            workspace_ids:
        Returns:
            WorkSpaceScanResponse
        """
        try:
            data = json.dumps({"workspaces": workspace_ids})
            path = (
                "/myorg/admin/workspaces/getInfo?"
                "datasetExpressions=True&datasetSchema=True"
                "&datasourceDetails=True&getArtifactUsers=True&lineage=True"
            )
            response_data = self.client.post(path=path, data=data)
            return WorkSpaceScanResponse(**response_data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error initiating workspace scan: {exc}")

        return None

    def fetch_workspace_scan_status(
        self, scan_id: str
    ) -> Optional[WorkSpaceScanResponse]:
        """Get Workspace scan status by id method
        Args:
            scan_id:
        Returns:
            WorkSpaceScanResponse
        """
        try:
            response_data = self.client.get(
                f"/myorg/admin/workspaces/scanStatus/{scan_id}"
            )
            return WorkSpaceScanResponse(**response_data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching workspace scan status: {exc}")

        return None

    def fetch_workspace_scan_result(self, scan_id: str) -> Optional[Workspaces]:
        """Get Workspace scan result by id method
        Args:
            scan_id:
        Returns:
            Workspaces
        """
        try:
            response_data = self.client.get(
                f"/myorg/admin/workspaces/scanResult/{scan_id}"
            )
            return Workspaces(**response_data)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching workspace scan result: {exc}")

        return None

    def wait_for_scan_complete(self, scan_id, timeout=180) -> bool:
        """
        Method to poll the scan status endpoint until the timeout
        """
        min_sleep_time = 3
        if min_sleep_time > timeout:
            logger.info(f"Timeout is set to minimum sleep time: {timeout}")
            timeout = min_sleep_time

        max_poll = timeout // min_sleep_time
        poll = 1
        while True:
            logger.info(f"Starting poll - {poll}/{max_poll}")
            response = self.fetch_workspace_scan_status(scan_id=scan_id)
            status = response.status
            if status:
                if status.lower() == "succeeded":
                    return True

            if poll == max_poll:
                break
            logger.info(f"Sleeping for {min_sleep_time} seconds")
            sleep(min_sleep_time)
            poll += 1

        return False
