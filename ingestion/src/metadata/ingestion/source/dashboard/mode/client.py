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
REST Auth & Client for Mode
"""
import traceback
from base64 import b64encode
from typing import Optional

from requests._internal_utils import to_native_string

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import utils_logger

logger = utils_logger()


EMBEDDED = "_embedded"
COLLECTIONS = "collections"
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


class ModeApiClient:
    """
    REST Auth & Client for Mode
    """

    client: REST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=str(config.hostPort),
            api_version="api",
            auth_header="Authorization",
            auth_token_mode="Basic",
            access_token=to_native_string(
                b64encode(
                    b":".join(
                        (
                            config.accessToken.encode(),
                            config.accessTokenPassword.get_secret_value().encode(),
                        )
                    )
                ).strip()
            ),
        )
        self.client = REST(client_config)

    def fetch_all_reports(
        self, workspace_name: str, filter: Optional[str] = "all"
    ) -> Optional[list]:
        """Method to fetch all reports for Mode
        Args:
            workspace_name:
            filter:
        Returns:
            dict
        """
        if filter not in ["custom", "all"]:
            logger.warning(
                "Invalid value for filter. Should be one of ['custom', 'all']"
            )
            return

        all_reports = []
        filter_param = f"?filter={filter}"
        response_collections = self.client.get(
            f"/{workspace_name}/{COLLECTIONS}{filter_param}"
        )
        collections = response_collections[EMBEDDED]["spaces"]
        for collection in collections:
            response_reports = self.get_all_reports_for_collection(
                workspace_name=workspace_name,
                collection_token=collection.get(TOKEN),
            )
            if response_reports:
                reports = response_reports[EMBEDDED][REPORTS]
                all_reports.extend(reports)
        return all_reports

    def get_all_reports_for_collection(
        self, workspace_name: str, collection_token: str
    ) -> Optional[dict]:
        """Method to fetch all reports for a collection
        Args:
            workspace_name:
            collection_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(
                f"/{workspace_name}/{COLLECTIONS}/{collection_token}/{REPORTS}"
            )
            return response
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching charts: {exc}")

        return None

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
