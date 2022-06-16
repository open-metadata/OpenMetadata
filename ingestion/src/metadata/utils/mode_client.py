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
from enum import Enum

from requests._internal_utils import to_native_string

from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.utils.logger import utils_logger

logger = utils_logger()


class ModeConstants(Enum):
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
    WEB = "web"
    HREF = "href"
    BASE_URL = "https://app.mode.com"


class ModeApiClient:
    client: REST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=ModeConstants.BASE_URL.value,
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

    def fetch_all_reports(self, workspace_name: str) -> list:
        """Method to fetch all reports for Mode
        Args:
            workspace_name:
        Returns:
            dict
        """
        try:
            all_reports = []
            response_collections = self.client.get(
                f"/{workspace_name}/{ModeConstants.COLLECTIONS.value}"
            )
            collections = response_collections[ModeConstants.EMBEDDED.value]["spaces"]
            for collection in collections:
                response_reports = self.get_all_reports_for_collection(
                    workspace_name=workspace_name,
                    collection_token=collection.get(ModeConstants.TOKEN.value),
                )
                reports = response_reports[ModeConstants.EMBEDDED.value][
                    ModeConstants.REPORTS.value
                ]
                all_reports.extend(reports)
            return all_reports
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)
            logger.debug(traceback.format_exc())

    def get_all_reports_for_collection(
        self, workspace_name: str, collection_token: str
    ) -> dict:
        """Method to fetch all reports for a collection
        Args:
            workspace_name:
            collection_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(
                f"/{workspace_name}/{ModeConstants.COLLECTIONS.value}/{collection_token}/{ModeConstants.REPORTS.value}"
            )
            return response
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)
            logger.debug(traceback.format_exc())

    def get_all_queries(self, workspace_name: str, report_token: str) -> dict:
        """Method to fetch all queries
        Args:
            workspace_name:
            report_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(
                f"/{workspace_name}/{ModeConstants.REPORTS.value}/{report_token}/{ModeConstants.QUERIES.value}"
            )
            return response
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)
            logger.debug(traceback.format_exc())

    def get_all_charts(
        self, workspace_name: str, report_token: str, query_token: str
    ) -> dict:
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
                f"/{workspace_name}/{ModeConstants.REPORTS.value}/{report_token}/{ModeConstants.QUERIES.value}/{query_token}/{ModeConstants.CHARTS.value}"
            )
            return response
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)
            logger.debug(traceback.format_exc())

    def get_all_data_sources(self, workspace_name: str) -> dict:
        """Method to get all data sources
        Args:
            workspace_name:
        Returns:
            dict
        """
        try:
            all_data_sources = {}
            response_data_sources = self.client.get(
                f"/{workspace_name}/{ModeConstants.DATA_SOURCES.value}"
            )
            data_sources = response_data_sources[ModeConstants.EMBEDDED.value][
                ModeConstants.DATA_SOURCES.value
            ]
            for data_source in data_sources:
                if data_source.get("id"):
                    data_source_dict = {
                        ModeConstants.TOKEN.value: data_source.get(
                            ModeConstants.TOKEN.value
                        ),
                        ModeConstants.NAME.value: data_source.get(
                            ModeConstants.NAME.value
                        ),
                        ModeConstants.DATABASE.value: data_source.get(
                            ModeConstants.DATABASE.value
                        ),
                    }
                    all_data_sources[data_source.get("id")] = data_source_dict

            return all_data_sources
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)
            logger.debug(traceback.format_exc())

    def get_user_account(self) -> dict:
        """Method to fetch account details
        Returns:
            dict
        """
        try:
            response = self.client.get(f"/account")
            return response
        except Exception as err:  # pylint: disable=broad-except
            logger.error(err)
            logger.debug(traceback.format_exc())
