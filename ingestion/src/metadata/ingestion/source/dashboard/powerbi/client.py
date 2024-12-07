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
from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.powerbi.file_client import PowerBiFileClient
from metadata.ingestion.source.dashboard.powerbi.models import (
    DashboardsResponse,
    Dataset,
    DatasetResponse,
    Group,
    GroupsResponse,
    PowerBIDashboard,
    PowerBIReport,
    PowerBiTable,
    PowerBiToken,
    ReportsResponse,
    TablesResponse,
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

    def __init__(self, config: PowerBIConnection):
        self.config = config
        self.msal_client = msal.ConfidentialClientApplication(
            client_id=self.config.clientId,
            client_credential=self.config.clientSecret.get_secret_value(),
            authority=self.config.authorityURI + self.config.tenantId,
        )
        client_config = ClientConfig(
            base_url="https://api.powerbi.com",
            api_version="v1.0",
            auth_token=self.get_auth_token,
            auth_header="Authorization",
            allow_redirects=True,
            retry_codes=[429],
            retry=100,
            retry_wait=30,
        )
        self.client = REST(client_config)

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

    def fetch_dashboards(self) -> Optional[List[PowerBIDashboard]]:
        """Get dashboards method
        Returns:
            List[PowerBIDashboard]
        """
        try:
            if self.config.useAdminApis:
                response_data = self.client.get("/myorg/admin/dashboards")
                response = DashboardsResponse(**response_data)
                return response.value
            group = self.fetch_all_workspaces()[0]
            return self.fetch_all_org_dashboards(group_id=group.id)

        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching dashboards: {exc}")

        return None

    def fetch_all_org_dashboards(
        self, group_id: str
    ) -> Optional[List[PowerBIDashboard]]:
        """Method to fetch all powerbi dashboards within the group
        Returns:
            List[PowerBIDashboard]
        """
        try:
            response_data = self.client.get(f"/myorg/groups/{group_id}/dashboards")
            response = DashboardsResponse(**response_data)
            return response.value
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching group dashboards: {exc}")

        return None

    def fetch_all_org_reports(self, group_id: str) -> Optional[List[PowerBIReport]]:
        """Method to fetch all powerbi reports within the group
        Returns:
            List[PowerBIReport]
        """
        try:
            response_data = self.client.get(f"/myorg/groups/{group_id}/reports")
            response = ReportsResponse(**response_data)
            return response.value
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching group reports: {exc}")

        return None

    def fetch_all_org_datasets(self, group_id: str) -> Optional[List[Dataset]]:
        """Method to fetch all powerbi datasets within the group
        Returns:
            List[Dataset]
        """
        try:
            response_data = self.client.get(f"/myorg/groups/{group_id}/datasets")
            response = DatasetResponse(**response_data)
            return response.value
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching group datasets: {exc}")

        return None

    def fetch_all_org_tiles(
        self, group_id: str, dashboard_id: str
    ) -> Optional[List[Tile]]:
        """Method to fetch all powerbi dashboard tiles
        Returns:
            List[Tile]
        """
        try:
            response_data = self.client.get(
                f"/myorg/groups/{group_id}/dashboards/{dashboard_id}/tiles"
            )
            response = TilesResponse(**response_data)
            return response.value
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching dashboard tiles: {exc}")

        return None

    def fetch_dataset_tables(
        self, group_id: str, dataset_id: str
    ) -> Optional[List[PowerBiTable]]:
        """Method to fetch dataset tables
        Returns:
            List[PowerBiTable]
        """
        try:
            response_data = self.client.get(
                f"/myorg/groups/{group_id}/datasets/{dataset_id}/tables"
            )
            if response_data:
                response = TablesResponse(**response_data)
                return response.value
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching dataset tables: {exc}")

        return None

    def fetch_all_workspaces(self) -> Optional[List[Group]]:
        """Method to fetch all powerbi workspace details
        Returns:
            Group
        """
        try:
            admin = "admin/" if self.config.useAdminApis else ""
            api_url = f"/myorg/{admin}groups"
            entities_per_page = self.config.pagination_entity_per_page
            params_data = {"$top": "1"}
            response_data = self.client.get(api_url, data=params_data)
            response = GroupsResponse(**response_data)
            count = response.odata_count
            indexes = math.ceil(count / entities_per_page)

            workspaces = []
            for index in range(indexes):
                params_data = {
                    "$top": str(entities_per_page),
                    "$skip": str(index * entities_per_page),
                }
                response_data = self.client.get(api_url, data=params_data)
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


class PowerBiClient(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    api_client: PowerBiApiClient
    file_client: Optional[PowerBiFileClient]
