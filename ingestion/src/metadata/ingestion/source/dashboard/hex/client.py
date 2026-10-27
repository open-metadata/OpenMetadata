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
REST Auth & Client for Hex
"""

import traceback
from collections.abc import Iterator
from typing import TypeVar

import yaml

from metadata.generated.schema.entity.services.connections.dashboard.hexConnection import (
    HexConnection,
)
from metadata.ingestion.connections.source_api_client import TrackedREST
from metadata.ingestion.ometa.client import ClientConfig
from metadata.ingestion.source.dashboard.hex.models import (
    Cell,
    CellContents,
    CellListResponse,
    DataConnectionsResponse,
    PagedResponse,
    Project,
    ProjectExport,
    ProjectListResponse,
    SqlCellContents,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()

PageT = TypeVar("PageT", bound=PagedResponse)

HEADERS = {
    "accept": "application/json",
    "Content-Type": "application/json",
}


class HexApiClient:
    """
    REST Auth & Client for Hex
    """

    client: TrackedREST

    def __init__(self, config: HexConnection):
        self.config = config

        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version="api/v1",
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (self.config.token.get_secret_value(), 0),
            auth_token_mode="Bearer",
            extra_headers=HEADERS,
            # Hex allows ~30 requests/minute per endpoint and answers 429 past that;
            # the cells endpoint is called once per project, so 429 must be retried.
            retry_codes=[429, 503, 504],
            limit_codes=[],
        )

        self.client = TrackedREST(client_config, source_name="hex")

    def test_project(self) -> None:
        """
        Test the connection to Hex
        """
        try:
            response = self.client.get("/projects?limit=1")
            # Check if we got a successful response with data
            if not response or not isinstance(response, dict):
                raise Exception("Invalid response from Hex API")  # noqa: TRY002, TRY301
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to test connection: {exc}")
            raise

    def get_projects(self) -> list[Project]:
        """
        Fetch all projects from Hex
        """
        projects = []
        try:
            for page in self._paginate("/projects", {}, ProjectListResponse):
                projects.extend(page.values)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching projects: {exc}")

        return projects

    def get_project_cells(self, project_id: str) -> list[Cell] | None:
        """
        Fetch the SQL cells of a project, in notebook order. None means neither the
        export nor the cells API could be read, as opposed to a project with no cells.

        The export comes first: only it names each cell's result variable, which
        chained SQL cells query instead of a warehouse table.
        """
        try:
            export = ProjectExport.model_validate(self.client.post("/projects/export", json={"projectId": project_id}))
            return _flatten_export_cells(yaml.safe_load(export.content).get("cells") or [])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug("Could not export Hex project %s, reading its cells instead: %s", project_id, exc)
        try:
            return [
                cell
                for page in self._paginate("/cells", {"projectId": project_id}, CellListResponse)
                for cell in page.values
            ]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching cells for project %s: %s", project_id, exc)
            return None

    def get_data_connection_types(self) -> dict[str, str]:
        """
        Map each data connection id to its warehouse type (snowflake, bigquery, ...)
        """
        try:
            return {
                connection.id: connection.type
                for page in self._paginate("/data-connections", {}, DataConnectionsResponse)
                for connection in page.values
                if connection.type
            }
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Error fetching data connections: %s", exc)
            return {}

    def _paginate(self, path: str, params: dict, model: type[PageT]) -> Iterator[PageT]:
        params = {**params, "limit": 100}
        while True:
            page = model.model_validate(self.client.get(path, data=params))
            yield page
            if not page.pagination or not page.pagination.after:
                return
            params["after"] = page.pagination.after

    def get_project_url(self, project: Project) -> str:
        """
        Build the URL for a project
        """
        return f"{clean_uri(self.config.hostPort)}/app/projects/{project.id}"


def _flatten_export_cells(export_cells: list[dict]) -> list[Cell]:
    """SQL cells of an export, with the ones nested in collapsible sections in place"""
    cells = []
    for export_cell in export_cells:
        config = export_cell.get("config") or {}
        if export_cell.get("cellType") == "SQL":
            cells.append(
                Cell(
                    id=export_cell["cellId"],
                    cellType="SQL",
                    label=export_cell.get("cellLabel"),
                    dataConnectionId=config.get("dataConnectionId"),
                    resultVariableName=config.get("resultVariableName"),
                    contents=CellContents(sqlCell=SqlCellContents(source=config.get("source"))),
                )
            )
        cells.extend(_flatten_export_cells(config.get("cells") or []))
    return cells
