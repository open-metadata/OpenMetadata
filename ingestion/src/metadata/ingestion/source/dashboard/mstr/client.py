#  Copyright 2023 Collate
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
REST Auth & Client for Mstr
"""
import traceback
from typing import List, Optional

import requests
from mstr.requests import MSTRRESTSession

from metadata.generated.schema.entity.services.connections.dashboard.mstrConnection import (
    MstrConnection,
)
from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.dashboard.mstr.models import (
    MstrDashboard,
    MstrDashboardDetails,
    MstrDashboardList,
    MstrProject,
    MstrProjectList,
    MstrSearchResult,
    MstrSearchResultList,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

API_VERSION = "MicroStrategyLibrary/api"


class MstrClient:
    """
    Client Handling API communication with Metabase
    """

    def _get_base_url(self, path=None):
        if not path:
            return f"{self.config.hostPort}/{API_VERSION}/"
        return f"{self.config.hostPort}/{API_VERSION}/{path}"

    def _get_mstr_session(self) -> MSTRRESTSession:
        try:
            session = MSTRRESTSession(base_url=self._get_base_url())
            session.login(
                username=self.config.username,
                password=self.config.password.get_secret_value(),
            )
            return session

        except KeyError as exe:
            msg = "Failed to fetch mstr session, please validate credentials"
            raise SourceConnectionException(msg) from exe

        except Exception as exc:
            msg = f"Unknown error in connection: {exc}."
            raise SourceConnectionException(msg) from exc

    def __init__(
        self,
        config: MstrConnection,
    ):
        self.config = config
        self.mstr_session = self._get_mstr_session()

    def is_project_name(self) -> bool:
        return True if self.config.projectName else False

    def get_projects_list(self) -> List[MstrProject]:
        """
        Get List of all projects
        """
        try:
            resp_projects = self.mstr_session.get(
                url=self._get_base_url("projects"), params={"include_auth": True}
            )

            if not resp_projects.ok:
                raise requests.ConnectionError()

            project_list = MstrProjectList(projects=resp_projects.json())
            return project_list.projects

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning("Failed to fetch the project list")

        return []

    def get_project_by_name(self) -> Optional[MstrProject]:
        """
        Get Project By Name
        """
        try:
            resp_projects = self.mstr_session.get(
                url=self._get_base_url(f"projects/{self.config.projectName}"),
                params={"include_auth": True},
            )

            if not resp_projects.ok:
                raise requests.ConnectionError()

            project = MstrProject(**resp_projects.json())
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
        """
        try:
            resp_results = self.mstr_session.get(
                url=self._get_base_url("searches/results"),
                params={
                    "include_auth": True,
                    "project_id": project_id,
                    "type": object_type,
                    "getAncestors": False,
                    "offset": 0,
                    "limit": -1,
                    "certifiedStatus": "ALL",
                    "isCrossCluster": False,
                    "result.hidden": False,
                },
            )

            if not resp_results.ok:
                raise requests.ConnectionError()

            results = []
            for resp_result in resp_results.json()["result"]:
                results.append(resp_result)

            results_list = MstrSearchResultList(results=results)
            return results_list.results

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
                    MstrDashboard(projectName=project_name, **result.dict())
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
            resp_dashboard = self.mstr_session.get(
                url=self._get_base_url(f"v2/dossiers/{dashboard_id}/definition"),
                params={
                    "include_auth": True,
                },
                headers={"X-MSTR-ProjectID": project_id},
            )

            if not resp_dashboard.ok:
                raise requests.ConnectionError()

            return MstrDashboardDetails(
                projectId=project_id, projectName=project_name, **resp_dashboard.json()
            )

        except Exception:
            logger.debug(traceback.format_exc())
            logger.warning(f"Failed to fetch the dashboard with id: {dashboard_id}")

        return None
