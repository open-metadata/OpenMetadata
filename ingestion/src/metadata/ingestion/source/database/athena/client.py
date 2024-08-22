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
Wrapper module of Athena client
"""
import traceback
from typing import Optional

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.ingestion.models.lf_tags_model import LFTags
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

    def get_database_tags(self, name: str) -> Optional[LFTags]:
        """
        Method to call the API and get the database tags
        """
        try:
            response = self.lake_formation_client.get_resource_lf_tags(
                Resource={"Database": {"Name": name}}
            )
            lf_tags = LFTags(**response)
            return lf_tags.LFTagOnDatabase
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Unable to get lf tags for database resource [{name}] due to: {exc}"
            )
        return None

    def get_table_and_column_tags(self, schema_name: str, table_name: str) -> LFTags:
        """
        Method to call the API and get the table and column tags
        """
        try:
            response = self.lake_formation_client.get_resource_lf_tags(
                Resource={
                    "Table": {
                        "DatabaseName": schema_name,
                        "Name": table_name,
                    },
                    "TableWithColumns": {
                        "DatabaseName": schema_name,
                        "Name": table_name,
                    },
                }
            )
            return LFTags(**response)
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(
                f"Unable to get lf tags for table resource [{table_name}] due to: {exc}"
            )
        return LFTags()
