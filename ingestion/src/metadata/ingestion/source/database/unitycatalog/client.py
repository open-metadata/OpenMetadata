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
Client to interact with databricks apis
"""
import json
import traceback

from requests import HTTPError

from metadata.generated.schema.entity.services.connections.database.databricks.azureAdSetup import (
    AzureAdSetup,
)
from metadata.generated.schema.entity.services.connections.database.databricks.databricksOAuth import (
    DatabricksOauth,
)
from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
    PersonalAccessToken,
)
from metadata.ingestion.source.database.databricks.auth import (
    get_azure_ad_auth,
    get_databricks_oauth_auth,
    get_personal_access_token_auth,
)
from metadata.ingestion.source.database.databricks.client import (
    API_TIMEOUT,
    DatabricksClient,
)
from metadata.ingestion.source.database.unitycatalog.models import LineageTableStreams
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
TABLE_LINEAGE_PATH = "/lineage-tracking/table-lineage"
TABLES_PATH = "/unity-catalog/tables"


class UnityCatalogClient(DatabricksClient):
    """
    UnityCatalogClient creates a Databricks connection based on DatabricksCredentials.
    """

    def _get_auth_header(self) -> dict[str, str]:
        """
        Method to get auth header
        """
        auth_method = {
            PersonalAccessToken: get_personal_access_token_auth,
            DatabricksOauth: get_databricks_oauth_auth,
            AzureAdSetup: get_azure_ad_auth,
        }.get(type(self.config.authType))
        if not auth_method:
            raise ValueError(
                f"Unsupported authentication type: {type(self.config.authType)}"
            )

        auth_args = auth_method(self.config)
        if auth_args.get("access_token"):
            return {"Authorization": f"Bearer {auth_args['access_token']}"}

        return auth_args["credentials_provider"]()()

    def get_table_lineage(self, table_name: str) -> LineageTableStreams:
        """
        Method returns table lineage details
        """
        try:
            data = {
                "table_name": table_name,
            }

            logger.debug(
                f"Fetching table lineage from Databricks API for: {table_name}"
            )
            raw_response = self.client.get(
                f"{self.base_url}{TABLE_LINEAGE_PATH}",
                headers=self.headers,
                data=json.dumps(data),
                timeout=API_TIMEOUT,
            )
            try:
                response = raw_response.json()
            except json.JSONDecodeError as json_err:
                logger.error(
                    f"Failed to parse JSON response for table lineage {table_name}. "
                    f"Status code: {raw_response.status_code}, "
                    f"Raw response: {raw_response.text}"
                )
                raise json_err

            if response:
                return LineageTableStreams(**response)

        except Exception as exc:
            logger.error(
                f"Unexpected error while fetching table lineage for {table_name}: {exc}"
            )
            logger.debug(traceback.format_exc())

        return LineageTableStreams()

    def get_owner_info(self, full_table_name: str) -> str:
        """
        get owner info from tables API
        """
        try:
            logger.debug(
                f"Fetching owner info from Databricks API for: {full_table_name}"
            )
            response = self.client.get(
                f"{self.base_url}{TABLES_PATH}/{full_table_name}",
                headers=self.headers,
                timeout=API_TIMEOUT,
            )
            if response.status_code != 200:
                raise HTTPError(response.text)
            return response.json().get("owner")
        except Exception as exc:
            logger.error(
                f"Unexpected error while fetching owner info for table {full_table_name}: {exc}"
            )
            logger.debug(traceback.format_exc())

        return
