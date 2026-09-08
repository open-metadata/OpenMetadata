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
REST Auth & Client for Mode
"""
import traceback
from base64 import b64encode
from typing import Any, Dict, List, Optional, cast

from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()


EMBEDDED = "_embedded"
SPACES = "spaces"
TOKEN = "token"
REPORTS = "reports"
QUERIES = "queries"
CHARTS = "charts"
NAME = "name"
DATA_SOURCES = "data_sources"
DATABASE = "database"
VIEW_VEGAS = "view_vegas"
TITLE = "title"
DESCRIPTION = "description"
LINKS = "_links"
SHARE = "share"
HREF = "href"
REPORTS_PAGE_SIZE = 30


class ModeApiClient:
    """
    REST Auth & Client for Mode
    """

    client: TrackedREST

    def __init__(self, config):
        self.config = config
        credentials = b":".join(
            (
                config.accessToken.encode(),
                config.accessTokenPassword.get_secret_value().encode(),
            )
        )
        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version="api",
            auth_header="Authorization",
            auth_token_mode="Basic",
            access_token=b64encode(credentials).strip().decode("ascii"),
        )
        self.client = TrackedREST(client_config, source_name="mode")

    def fetch_all_reports(
        self, workspace_name: str, filter: Optional[str] = "all"
    ) -> List[Dict[str, Any]]:
        """Method to fetch all reports for Mode
        Args:
            workspace_name:
            filter:
        Returns:
            dict
        """
        if filter not in ["custom", "all"]:
            raise ValueError(
                f"Invalid Mode filter [{filter}]. Expected one of ['custom', 'all']"
            )

        all_reports: List[Dict[str, Any]] = []
        filter_param = f"?filter={filter}"
        response_spaces = cast(
            Dict[str, Any],
            self.client.get(f"/{workspace_name}/{SPACES}{filter_param}"),
        )
        spaces = response_spaces[EMBEDDED][SPACES]
        for space in spaces:
            page = 1
            previous_reports = None
            while True:
                response_reports = self.get_reports_for_space(
                    workspace_name=workspace_name,
                    space_token=space[TOKEN],
                    page=page,
                )
                reports = response_reports[EMBEDDED][REPORTS]
                if reports and reports == previous_reports:
                    raise RuntimeError(
                        f"Mode returned the same report page twice for space "
                        f"[{space[TOKEN]}] at page [{page}]"
                    )
                all_reports.extend(reports)
                if len(reports) < REPORTS_PAGE_SIZE:
                    break
                previous_reports = reports
                page += 1
        return all_reports

    def get_reports_for_space(
        self, workspace_name: str, space_token: str, page: int
    ) -> Dict[str, Any]:
        """Fetch one page of reports for a space.

        Args:
            workspace_name:
            space_token:
            page:
        Returns:
            dict
        """
        return cast(
            Dict[str, Any],
            self.client.get(
                f"/{workspace_name}/{SPACES}/{space_token}/{REPORTS}?page={page}"
            ),
        )

    def get_all_queries(self, workspace_name: str, report_token: str) -> Optional[dict]:
        """Method to fetch all queries
        Args:
            workspace_name:
            report_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(
                f"/{workspace_name}/{REPORTS}/{report_token}/{QUERIES}"
            )
            return response
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching all queries: {exc}")

        return None

    def get_all_charts(
        self, workspace_name: str, report_token: str, query_token: str
    ) -> Optional[dict]:
        """Method to fetch all charts
        Args:
            workspace_name:
            report_token:
            query_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(
                f"/{workspace_name}/{REPORTS}/{report_token}/{QUERIES}/{query_token}/{CHARTS}"
            )
            return response
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching all charts: {exc}")

        return None

    def get_all_data_sources(self, workspace_name: str) -> Optional[dict]:
        """Method to get all data sources
        Args:
            workspace_name:
        Returns:
            dict
        """
        try:
            all_data_sources = {}
            response_data_sources = self.client.get(f"/{workspace_name}/{DATA_SOURCES}")
            data_sources = response_data_sources[EMBEDDED][DATA_SOURCES]
            for data_source in data_sources:
                if data_source.get("id"):
                    data_source_dict = {
                        TOKEN: data_source.get(TOKEN),
                        NAME: data_source.get(NAME),
                        DATABASE: data_source.get(DATABASE),
                    }
                    all_data_sources[data_source.get("id")] = data_source_dict

            return all_data_sources
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching all data sources: {exc}")

        return None

    def get_workspace(self, workspace_name: str) -> Optional[dict]:
        """Method to get info about a workspace
        Args:
            workspace_name:
        Returns:
            dict
        """
        try:
            response = self.client.get(f"/{workspace_name}")
            return response
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error testing workspace connection: {exc}")
            raise exc
