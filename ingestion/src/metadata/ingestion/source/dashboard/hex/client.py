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
from typing import List

from metadata.generated.schema.entity.services.connections.dashboard.hexConnection import (
    HexConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.dashboard.hex.models import Project, ProjectListResponse
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.logger import utils_logger

logger = utils_logger()

HEADERS = {
    "accept": "application/json",
    "Content-Type": "application/json",
}


class HexApiClient:
    """
    REST Auth & Client for Hex
    """

    client: REST

    def __init__(self, config: HexConnection):
        self.config = config

        client_config = ClientConfig(
            base_url=clean_uri(config.hostPort),
            api_version="api/v1",
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: (self.config.token.get_secret_value(), 0),
            auth_token_mode="Bearer",
            extra_headers=HEADERS,
        )

        self.client = REST(client_config)

    def test_project(self) -> None:
        """
        Test the connection to Hex
        """
        try:
            response = self.client.get("/projects?limit=1")
            # Check if we got a successful response with data
            if not response or not isinstance(response, dict):
                raise Exception("Invalid response from Hex API")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Failed to test connection: {exc}")
            raise

    def get_projects(self) -> List[Project]:
        """
        Fetch all projects from Hex
        """
        projects = []
        try:
            params = {"limit": 100}
            after = None
            while True:
                if after:
                    params["after"] = after

                response = self.client.get("/projects", data=params)
                project_response = ProjectListResponse.model_validate(response)
                projects.extend(project_response.values)

                if (
                    not project_response.pagination
                    or not project_response.pagination.after
                ):
                    break

                after = project_response.pagination.after

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.error(f"Error fetching projects: {exc}")

        return projects

    def get_project_url(self, project: Project) -> str:
        """
        Build the URL for a project
        """
        return f"{clean_uri(self.config.hostPort)}/app/projects/{project.id}"
