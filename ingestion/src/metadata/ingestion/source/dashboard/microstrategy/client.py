#  Copyright 2023 Collate
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
REST Auth & Client for MicroStrategy
"""
import traceback
from typing import List, Optional

import requests

from metadata.generated.schema.entity.services.connections.dashboard.microStrategyConnection import (
    MicroStrategyConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.microstrategy.models import (
    AuthHeaderCookie,
    MstrDashboard,
    MstrDashboardDetails,
    MstrDashboardList,
    MstrProject,
    MstrProjectList,
    MstrSearchResult,
    MstrSearchResultList,
)
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

API_VERSION = "MicroStrategyLibrary/api"
HEADERS = {"Content-Type": "application/json"}
APPLICATION_TYPE = 35


class MicroStrategyClient:
    """
    Client Handling API communication with MicroStrategy
    """

    def _get_base_url(self, path=None):
        if not path:
            return f"{clean_uri(str(self.config.hostPort))}/{API_VERSION}"
        return f"{clean_uri(str(self.config.hostPort))}/{API_VERSION}/{path}"

    def __init__(
        self,
        config: MicroStrategyConnection,
    ):
        self.config = config

        self.auth_params = self._get_auth_header_and_cookies()

        client_config = ClientConfig(
            base_url=clean_uri(str(self.config.hostPort)),
            api_version=API_VERSION,
            extra_headers=self.auth_params.auth_header if self.auth_params else None,
            allow_redirects=True,
            cookies=self.auth_params.auth_cookies if self.auth_params else None,
        )

        self.client = REST(client_config)

    def get_auth_params(self) -> AuthHeaderCookie:
        """
        Test whether we can fetch auth_token from the api
        """
        data = {
            "username": self.config.username,
            "password": self.config.password.get_secret_value(),
            "loginMode": int(self.config.loginMode),
            "applicationType": APPLICATION_TYPE,
        }
        response = requests.post(
            url=self._get_base_url("auth/login"), json=data, headers=HEADERS, timeout=60
        )
        response.raise_for_status()
        if (
            not response.ok
            or response.status_code != 204
            or "X-MSTR-AuthToken" not in response.headers
        ):
            raise SourceConnectionException(
                f"Failed to Fetch Token, please validate your credentials and login_mode : {response.text}"
            )
        return AuthHeaderCookie(
            auth_header=response.headers, auth_cookies=response.cookies
        )

    def _get_auth_header_and_cookies(self) -> Optional[AuthHeaderCookie]:
        """
        Send a request to authenticate the user and get headers and

        To know about the data params below please visit
        https://demo.microstrategy.com/MicroStrategyLibrary/api-docs/index.html#/Authentication/postLogin
        """
        try:
            auth_data = self.get_auth_params()
            if auth_data:
                self._set_api_session(auth_data)
                return auth_data
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(
                f"Failed to fetch the auth header and cookies due to : [{exc}]"
            )
        return None

    def _set_api_session(self, auth_data: AuthHeaderCookie) -> bool:
        """
        Set the user api session to active this will keep the connection alive
        """
        api_session = requests.put(
            url=self._get_base_url("sessions"),
            headers=auth_data.auth_header,
            cookies=auth_data.auth_cookies,
            timeout=60,
        )
        if api_session.ok:
            logger.info(
                f"Connection Successful User {self.config.username} is Authenticated"
            )
            return True
        raise requests.ConnectionError(
            "Connection Failed, Failed to set an api session, Please validate the credentials"
        )

    def close_api_session(self) -> None:
        """
        Closes the active api session
        """
        try:
            close_api_session = self.client.post(
                path="/auth/logout",
            )
            if close_api_session.ok:
                logger.info("API Session Closed Successfully")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to close the api sesison due to [{exc}]")

    def is_project_name(self) -> bool:
        return bool(self.config.projectName)

    def get_projects_list(self) -> List[MstrProject]:
        """
        Get List of all projects
        """
        try:
            resp_projects = self.client.get(
                path="/projects",
            )

            project_list = MstrProjectList(projects=resp_projects)
            return project_list.projects

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the project list due to [{exc}]")

        return []

    def get_project_by_name(self) -> Optional[MstrProject]:
        """
        Get Project By Name
        """
        try:
            resp_projects = self.client.get(
                path=f"/projects/{self.config.projectName}",
            )

            project = MstrProject.model_validate(resp_projects)
            return project

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the project list")

        return None

    def get_search_results_list(
        self, project_id, object_type
    ) -> List[MstrSearchResult]:
        """
        Get Search Results

        To know about the data params below please visit
        https://demo.microstrategy.com/MicroStrategyLibrary/api-docs/index.html?#/Browsing/doQuickSearch
        """
        try:
            data = {
                "project_id": project_id,
                "type": object_type,
                "getAncestors": False,
                "offset": 0,
                "limit": -1,
                "certifiedStatus": "ALL",
                "isCrossCluster": False,
                "result.hidden": False,
            }
            resp_results = self.client.get(
                path="/searches/results",
                data=data,
            )

            results_list = MstrSearchResultList.model_validate(resp_results).result
            return results_list

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the Search Result list")

        return []

    def get_dashboards_list(self, project_id, project_name) -> List[MstrDashboard]:
        """
        Get Dashboard
        """
        try:
            results = self.get_search_results_list(
                project_id=project_id, object_type=55
            )

            dashboards = []
            for result in results:
                dashboards.append(
                    MstrDashboard(projectName=project_name, **result.model_dump())
                )

            dashboards_list = MstrDashboardList(dashboards=dashboards)
            return dashboards_list.dashboards

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the dashboard list")

        return []

    def get_dashboard_details(
        self, project_id, project_name, dashboard_id
    ) -> Optional[MstrDashboardDetails]:
        """
        Get Dashboard Details
        """
        try:
            headers = {"X-MSTR-ProjectID": project_id} | self.auth_params.auth_header
            resp_dashboard = self.client._request(  # pylint: disable=protected-access
                "GET", path=f"/v2/dossiers/{dashboard_id}/definition", headers=headers
            )

            return MstrDashboardDetails(
                projectId=project_id, projectName=project_name, **resp_dashboard
            )

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the dashboard with id: {dashboard_id}")

        return None

    def get_cube_sql_details(self, project_id: str, cube_id: str) -> Optional[str]:
        """
        Get Cube SQL Details
        """
        try:
            headers = {
                "X-MSTR-ProjectID": project_id,
                "cubeId": cube_id,
            } | self.auth_params.auth_header

            resp_dataset = self.client._request(  # pylint: disable=protected-access
                "GET", path=f"/v2/cubes/{cube_id}/sqlView", headers=headers
            )
            return resp_dataset["sqlStatement"]

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the cube with id: {cube_id}")

        return None
