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
REST Auth & Client for PowerBi
"""
import json
import math
import traceback
from copy import deepcopy
from time import sleep
from typing import List, Optional, Tuple

import msal
from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
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
from metadata.utils.filters import validate_regex
from metadata.utils.logger import utils_logger

logger = utils_logger()

GETGROUPS_DEFAULT_PARAMS = {"$top": "1", "$skip": "0"}
API_RESPONSE_MESSAGE_KEY = "message"
AUTH_TOKEN_MAX_RETRIES = 5
AUTH_TOKEN_RETRY_WAIT = 120
# Similar inner methods with mode client. That's fine.
# pylint: disable=duplicate-code
class PowerBiApiClient:
    """
    REST Auth & Client for PowerBi
    """

    client: REST

    def __init__(self, config: PowerBIConnection):
        self.config = config
        self.pagination_entity_per_page = min(
            100, self.config.pagination_entity_per_page
        )
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

        response_data = self.get_auth_token_from_cache()
        if not response_data:
            logger.info("Token does not exist in the cache. Getting a new token.")
            response_data = self.generate_new_auth_token()
        response_data = response_data or {}
        auth_response = PowerBiToken(**response_data)
        if not auth_response.access_token:
            raise InvalidSourceException(
                f"Failed to generate the PowerBi access token. Please check provided config {response_data}"
            )

        logger.info("PowerBi Access Token generated successfully")
        return auth_response.access_token, auth_response.expires_in

    def generate_new_auth_token(self) -> Optional[dict]:
        """generate new auth token"""
        retry = AUTH_TOKEN_MAX_RETRIES
        while retry:
            try:
                response_data = self.msal_client.acquire_token_for_client(
                    scopes=self.config.scope
                )
                return response_data
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error generating new auth token: {exc}")
                # wait for time and retry
                retry -= 1
                if retry:
                    logger.warning(
                        f"Error generating new token: {exc}, "
                        f"sleep {AUTH_TOKEN_RETRY_WAIT} seconds retrying {retry} more times.."
                    )
                    sleep(AUTH_TOKEN_RETRY_WAIT)
                else:
                    logger.warning(
                        "Could not generate new token after maximum retries, "
                        "Please check provided configs"
                    )
        return None

    def get_auth_token_from_cache(self) -> Optional[dict]:
        """fetch auth token from cache"""
        retry = AUTH_TOKEN_MAX_RETRIES
        while retry:
            try:
                response_data = self.msal_client.acquire_token_silent(
                    scopes=self.config.scope, account=None
                )
                return response_data
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(f"Error getting token from cache: {exc}")
                retry -= 1
                if retry:
                    logger.warning(
                        f"Error getting token from cache: {exc}, "
                        f"sleep {AUTH_TOKEN_RETRY_WAIT} seconds retrying {retry} more times.."
                    )
                    sleep(AUTH_TOKEN_RETRY_WAIT)
                else:
                    logger.warning(
                        "Could not get token from cache after maximum retries, "
                        "Please check provided configs"
                    )
        return None

    def fetch_dashboards(self) -> Optional[List[PowerBIDashboard]]:
        """Get dashboards method
        Returns:
            List[PowerBIDashboard]
        """
        if self.config.useAdminApis:
            response_data = self.client.get("/myorg/admin/dashboards")
            response = DashboardsResponse(**response_data)
            return response.value
        group = self.fetch_all_workspaces()[0]
        return self.fetch_all_org_dashboards(group_id=group.id)

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

    def regex_to_odata_condition(self, regex: str) -> str:
        """
        Convert a regex pattern to an OData filter condition
        """
        try:
            # Handle empty pattern
            if not regex:
                return ""

            # Exact match
            if regex.startswith("^") and regex.endswith("$"):
                literal = regex[1:-1]
                return f"trim(name) eq '{literal}'"

            # Starts with
            if regex.startswith("^"):
                remaining = regex[1:]
                parts = remaining.split(".*", 1)
                literal = parts[0] if parts else ""
                return f"startswith(name, '{literal}')"

            # Ends with
            if regex.endswith("$"):
                remaining = regex[:-1]
                parts = remaining.split(".*")
                literal = parts[-1] if parts else ""
                return f"endswith(name, '{literal}')"

            # Contains
            if regex.startswith(".*") and regex.endswith(".*"):
                parts = regex.split(".*")
                literal = parts[1] if len(parts) > 1 else ""
            else:
                literal = regex
            return f"contains(name, '{literal}')"
        except Exception as exc:
            logger.warning(
                f"Error converting regex '{regex}' to OData condition: {exc}"
            )
            return ""

    def create_filter_query(self, filter_pattern) -> Optional[str]:
        """
        Create a complete filter query for workspaces from filter_pattern
        """
        try:

            validate_regex(filter_pattern.includes)
            validate_regex(filter_pattern.excludes)
            project_to_include = filter_pattern.includes
            project_to_exclude = filter_pattern.excludes
            filter_conditions = []
            if project_to_include:
                include_conditions = []
                for pattern in project_to_include:
                    condition = self.regex_to_odata_condition(pattern)
                    if condition:
                        include_conditions.append(f"{condition}")

                if include_conditions:
                    filter_conditions.append(f"{' or '.join(include_conditions)}")

            if project_to_exclude:
                exclude_conditions = []
                for pattern in project_to_exclude:
                    condition = self.regex_to_odata_condition(pattern)
                    if condition:
                        exclude_conditions.append(f"not({condition})")

                if exclude_conditions:
                    filter_conditions.append(f"{' and '.join(exclude_conditions)}")

            filter_query = " and ".join(filter_conditions) if filter_conditions else ""
            return filter_query if filter_query else None
        except Exception as exc:
            logger.warning(
                f"Creating filter query from the project filter pattern failed: {exc}. "
                "The projects will be filtered further inside OpenMetadata."
            )
            return None

    # pylint: disable=too-many-branches,too-many-statements
    def fetch_all_workspaces(
        self, filter_pattern: Optional[FilterPattern] = None
    ) -> Optional[List[Group]]:
        """Method to fetch all powerbi workspace details
        Returns:
            Group
        """
        try:
            admin = "admin/" if self.config.useAdminApis else ""
            api_url = f"/myorg/{admin}groups"
            entities_per_page = self.pagination_entity_per_page
            failed_indexes = []
            parsed_filter_query = None
            if filter_pattern:
                parsed_filter_query = self.create_filter_query(filter_pattern)
                logger.debug(f"Filter query applied = {parsed_filter_query}")
            params_data = deepcopy(GETGROUPS_DEFAULT_PARAMS)
            if parsed_filter_query:
                params_data["$filter"] = parsed_filter_query
            response = self.client.get(api_url, data=params_data)
            if (
                not response
                or API_RESPONSE_MESSAGE_KEY in response
                or len(response) != len(GroupsResponse.__annotations__)
            ):
                logger.warning("Error fetching workspaces between results: (0, 1)")
                if response and response.get(API_RESPONSE_MESSAGE_KEY):
                    logger.warning(
                        "Error message from API response: "
                        f"{str(response.get(API_RESPONSE_MESSAGE_KEY))}"
                    )
                failed_indexes.append(params_data)
                count = 0
            else:
                try:
                    response = GroupsResponse(**response)
                    count = response.odata_count
                except Exception as exc:
                    logger.warning(f"Error processing GetGroups response: {exc}")
                    count = 0
            indexes = math.ceil(count / entities_per_page)
            logger.debug(
                f"Total {count} workspaces found, Will run {indexes} iterations fetching"
                f" maximum {entities_per_page} workspaces in a single iteration"
            )
            workspaces = []
            for index in range(indexes):
                params_data = {
                    "$top": str(entities_per_page),
                    "$skip": str(index * entities_per_page),
                }
                if parsed_filter_query:
                    params_data["$filter"] = parsed_filter_query

                response = self.client.get(api_url, data=params_data)
                if (
                    not response
                    or API_RESPONSE_MESSAGE_KEY in response
                    or len(response) != len(GroupsResponse.__annotations__)
                ):
                    index_range = (
                        int(params_data.get("$skip")),
                        int(params_data.get("$skip")) + int(params_data.get("$top")),
                    )
                    logger.warning(
                        f"Error fetching workspaces between results: {str(index_range)}"
                    )
                    if response and response.get(API_RESPONSE_MESSAGE_KEY):
                        logger.warning(
                            "Error message from API response: "
                            f"{str(response.get(API_RESPONSE_MESSAGE_KEY))}"
                        )
                    failed_indexes.append(params_data)
                    continue
                try:
                    response = GroupsResponse(**response)
                    workspaces.extend(response.value)
                except Exception as exc:
                    logger.warning(f"Error processing GetGroups response: {exc}")

            if failed_indexes:
                logger.info(
                    "Retrying one more time on failed indexes to get workspaces"
                )
                for params_data in failed_indexes:
                    response = self.client.get(api_url, data=params_data)
                    if (
                        not response
                        or API_RESPONSE_MESSAGE_KEY in response
                        or len(response) != len(GroupsResponse.__annotations__)
                    ):
                        index_range = (
                            int(params_data.get("$skip")),
                            int(params_data.get("$skip"))
                            + int(params_data.get("$top")),
                        )
                        logger.warning(
                            f"Workspaces between results {str(index_range)} "
                            "could not be fetched on multiple attempts"
                        )
                        if response and response.get(API_RESPONSE_MESSAGE_KEY):
                            logger.warning(
                                "Error message from API response: "
                                f"{str(response.get(API_RESPONSE_MESSAGE_KEY))}"
                            )
                        continue
                    try:
                        response = GroupsResponse(**response)
                        workspaces.extend(response.value)
                    except Exception as exc:
                        logger.warning(f"Error processing GetGroups response: {exc}")
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
