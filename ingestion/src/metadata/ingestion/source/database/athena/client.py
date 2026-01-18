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
Wrapper module of Athena client
"""
import traceback
from typing import List, Optional

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.ingestion.models.lf_tags_model import LFTags, TagItem
from metadata.ingestion.source.database.athena.connection import (
    get_lake_formation_client,
)
from metadata.utils.logger import ometa_logger

logger = ometa_logger()


class AthenaLakeFormationClient:
    """
    Athena Lake Formation Client
    """

    def __init__(
        self,
        connection: AthenaConnection,
    ):
        self.lake_formation_client = get_lake_formation_client(connection=connection)
        self.catalog_id = connection.catalogId

    def get_database_tags(self, name: str) -> Optional[List[TagItem]]:
        """
        Method to call the API and get the database tags
        """
        try:
            resource = {"Database": {"Name": name}}
            if self.catalog_id:
                resource["Database"]["CatalogId"] = self.catalog_id
            response = self.lake_formation_client.get_resource_lf_tags(Resource=resource)
            lf_tags = LFTags(**response)
            return lf_tags.LFTagOnDatabase
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to get LF-Tags for database resource [{name}] due to: {exc}. Skipping."
            )
        return None

    def get_table_and_column_tags(self, schema_name: str, table_name: str) -> LFTags:
        """
        Method to call the API and get the table and column tags
        """
        try:
            table_resource = {
                "DatabaseName": schema_name,
                "Name": table_name,
            }
            table_with_columns_resource = {
                "DatabaseName": schema_name,
                "Name": table_name,
            }
            if self.catalog_id:
                table_resource["CatalogId"] = self.catalog_id
                table_with_columns_resource["CatalogId"] = self.catalog_id
            response = self.lake_formation_client.get_resource_lf_tags(
                Resource={
                    "Table": table_resource,
                    "TableWithColumns": table_with_columns_resource,
                }
            )
            return LFTags(**response)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to get LF-Tags for table resource [{table_name}] due to: {exc}. Skipping."
            )
        return LFTags()
