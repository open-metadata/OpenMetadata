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
Clickhouse usage module
"""

import ast
import traceback
from abc import ABC
from datetime import datetime
from typing import List, Optional

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class ClickhouseQueryParserSource(QueryParserSource, ABC):
    """
    Clickhouse base for Usage and Lineage
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.root.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )
        return cls(config, metadata)

    @staticmethod
    def get_schema_name(data: dict) -> str:
        """
        Method to fetch schema name from row data
        """
        try:
            if data.get("schema_name"):
                schema_list = []
                if isinstance(data["schema_name"], str):
                    schema_list = ast.literal_eval(data["schema_name"])
                elif isinstance(data["schema_name"], list):
                    schema_list = data["schema_name"]
                schema = schema_list[0] if len(schema_list) == 1 else None
                return schema
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.debug(f"Failed to fetch the schema name due to: {exc}")
        return None

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.get_filters(),
            result_limit=self.source_config.resultLimit,
        )

    def prepare(self):
        """
        Fetch queries only from DB that is ingested in OM
        """
        databases: List[Database] = self.metadata.list_all_entities(
            Database, ["databaseSchemas"], params={"service": self.config.serviceName}
        )
        database_name_list = []
        schema_name_list = []

        for database in databases:
            database_name_list.append(database.name.root)
            if self.schema_field and database.databaseSchemas:
                for schema in database.databaseSchemas.root:
                    schema_name_list.append(schema.name)

        if self.schema_field and schema_name_list:
            self.filters += (  # pylint: disable=no-member
                f" AND hasAny({self.schema_field}, ['"
                + "','".join(schema_name_list)
                + "'])"
            )
