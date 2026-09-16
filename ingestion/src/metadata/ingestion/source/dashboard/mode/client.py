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

import json
import traceback
from base64 import b64encode
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:

    def to_native_string(string: str | bytes, encoding: str = "ascii") -> str: ...
else:
    from requests._internal_utils import to_native_string

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


def _report_key(report: dict[str, Any]) -> str:
    """Identify a report for de-duplication, tolerating a missing token."""
    token = report.get(TOKEN)
    if token:
        return str(token)
    return json.dumps(report, sort_keys=True, default=str)


class ModeApiClient:
    """
    REST Auth & Client for Mode
    """

    client: TrackedREST

    def __init__(self, config):
        self.config = config
        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
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
        self.client = TrackedREST(client_config, source_name="mode")

    def fetch_all_reports(self, workspace_name: str, filter: str | None = "all") -> list[dict[str, Any]]:
        """Method to fetch all reports for Mode

        Mode neither documents a stable report page size nor guarantees an empty page
        past the last one: an out-of-range page may be clamped back to the last page,
        and a page parameter the API ignores repeats page one indefinitely. Pagination
        therefore stops once a page carries no unseen report, which terminates in all
        of those cases without assuming how many records a full page holds.

        Args:
            workspace_name:
            filter:
        Returns:
            the report records of every visible space
        """
        if filter not in ["custom", "all"]:
            raise ValueError(f"Invalid Mode filter [{filter}]. Expected one of ['custom', 'all']")

        all_reports: list[dict[str, Any]] = []
        filter_param = f"?filter={filter}"
        response_spaces = cast(
            "dict[str, Any]",
            self.client.get(f"/{workspace_name}/{SPACES}{filter_param}"),
        )
        spaces = response_spaces[EMBEDDED][SPACES]
        for space in spaces:
            seen_reports = set()
            page = 1
            while True:
                response_reports = self.get_reports_for_space(
                    workspace_name=workspace_name,
                    space_token=space[TOKEN],
                    page=page,
                )
                reports = response_reports[EMBEDDED][REPORTS]
                new_reports = [report for report in reports if _report_key(report) not in seen_reports]
                if not new_reports:
                    break
                seen_reports.update(_report_key(report) for report in new_reports)
                all_reports.extend(new_reports)
                page += 1
        return all_reports

    def get_reports_for_space(self, workspace_name: str, space_token: str, page: int) -> dict[str, Any]:
        """Fetch one page of reports for a space.

        Args:
            workspace_name:
            space_token:
            page:
        Returns:
            dict
        """
        return cast(
            "dict[str, Any]",
            self.client.get(f"/{workspace_name}/{SPACES}/{space_token}/{REPORTS}?page={page}"),
        )

    def get_all_queries(self, workspace_name: str, report_token: str) -> dict | None:
        """Method to fetch all queries
        Args:
            workspace_name:
            report_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(f"/{workspace_name}/{REPORTS}/{report_token}/{QUERIES}")
            return response  # noqa: RET504, TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching all queries: {exc}")

        return None

    def get_all_charts(self, workspace_name: str, report_token: str, query_token: str) -> dict | None:
        """Method to fetch all charts
        Args:
            workspace_name:
            report_token:
            query_token:
        Returns:
            dict
        """
        try:
            response = self.client.get(f"/{workspace_name}/{REPORTS}/{report_token}/{QUERIES}/{query_token}/{CHARTS}")
            return response  # noqa: RET504, TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching all charts: {exc}")

        return None

    def get_all_data_sources(self, workspace_name: str) -> dict | None:
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

            return all_data_sources  # noqa: TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error fetching all data sources: {exc}")

        return None

    def get_workspace(self, workspace_name: str) -> dict | None:
        """Method to get info about a workspace
        Args:
            workspace_name:
        Returns:
            dict
        """
        try:
            response = self.client.get(f"/{workspace_name}")
            return response  # noqa: RET504, TRY300
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error testing workspace connection: {exc}")
            raise exc  # noqa: TRY201
