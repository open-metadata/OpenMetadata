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
from functools import cached_property
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
    DataConnection,
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


class HexAccessDeniedError(Exception):
    """The token isn't allowed to read this; asking again won't change that"""


PageT = TypeVar("PageT", bound=PagedResponse)

# The token isn't allowed to read it, so it won't be readable on a retry either;
# any other failure is transient
UNAVAILABLE_STATUSES = {403, 404}

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
            # the project export is called once per project, so 429 must be retried.
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
        Fetch the SQL cells of a project, in notebook order. None means they could not
        be read this time, as opposed to a project with no cells.

        The export comes first: only it names each cell's result variable, which
        chained SQL cells query instead of a warehouse table. The cells API, which
        loses those chains, is only used when the export is not allowed at all; on a
        transient export failure the cells it would give are incomplete, so None.
        """
        try:
            export = ProjectExport.model_validate(self.client.post("/projects/export", json={"projectId": project_id}))
            return _flatten_export_cells(yaml.safe_load(export.content).get("cells") or [])
        except Exception as exc:
            logger.debug(traceback.format_exc())
            if _status_code(exc) not in UNAVAILABLE_STATUSES:
                logger.warning("Error exporting Hex project %s: %s", project_id, exc)
                return None
            logger.debug("Hex project %s can't be exported, reading its cells instead: %s", project_id, exc)
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

    def get_data_connections(self) -> dict[str, DataConnection] | None:
        """
        Data connections by id, for their warehouse type and default database and
        schema. None when they can't be read this time; HexAccessDeniedError when the
        token isn't allowed to read them, which a retry won't change.
        """
        try:
            return {
                connection.id: connection
                for page in self._paginate("/data-connections", {}, DataConnectionsResponse)
                for connection in page.values
            }
        except Exception as exc:
            logger.debug(traceback.format_exc())
            if _status_code(exc) in UNAVAILABLE_STATUSES:
                raise HexAccessDeniedError(f"Hex data connections can't be read with this token: {exc}") from exc
            logger.warning("Error fetching data connections: %s", exc)
            return None

    def _paginate(self, path: str, params: dict, model: type[PageT]) -> Iterator[PageT]:
        params = {**params, "limit": 100}
        while True:
            page = model.model_validate(self.client.get(path, data=params))
            yield page
            if not page.pagination or not page.pagination.after:
                return
            params["after"] = page.pagination.after

    @cached_property
    def workspace_id(self) -> str | None:
        """
        Hex app URLs are scoped by the workspace (org) UUID, which no project endpoint returns
        """
        try:
            response = self.client.get("/users/me")
            if not isinstance(response, dict):
                raise TypeError(f"Unexpected /users/me response: {response!r}")  # noqa: TRY301
            return response["org"]["id"]
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not fetch the Hex workspace id, dashboard URLs will be skipped: %s", exc)
            return None

    def get_project_url(self, project: Project) -> str | None:
        """
        Build the URL for a project
        """
        if not self.workspace_id:
            return None
        # Only editors can open the notebook (/hex); a published app (/app) is viewable by everyone
        path = "app" if project.lastPublishedAt else "hex"
        return f"{clean_uri(self.config.hostPort)}/{self.workspace_id}/{path}/{project.id}"


def _flatten_export_cells(export_cells: list[dict]) -> list[Cell]:
    """SQL cells of an export, with the ones nested in collapsible sections in place"""
    cells = []
    for export_cell in export_cells:
        config = export_cell.get("config") or {}
        if export_cell.get("cellType") == "SQL":
            cells.append(
                Cell(
                    # The export's cellId is the cells API's staticId, the id kept across versions
                    id=export_cell["cellId"],
                    staticId=export_cell["cellId"],
                    cellType="SQL",
                    label=export_cell.get("cellLabel"),
                    dataConnectionId=config.get("dataConnectionId"),
                    resultVariableName=config.get("resultVariableName"),
                    contents=CellContents(sqlCell=SqlCellContents(source=config.get("source"))),
                )
            )
        cells.extend(_flatten_export_cells(config.get("cells") or []))
    return cells


def _status_code(exc: Exception) -> int | None:
    """HTTP status of a failed call: an APIError carries it, a requests HTTPError on its response"""
    status = getattr(exc, "status_code", None)
    return status if status is not None else getattr(getattr(exc, "response", None), "status_code", None)
