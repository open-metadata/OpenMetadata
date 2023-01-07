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
from abc import ABC
from datetime import datetime
from typing import List

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.query_parser_source import QueryParserSource


class ClickhouseQueryParserSource(QueryParserSource, ABC):
    """
    Clickhouse base for Usage and Lineage
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: ClickhouseConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, ClickhouseConnection):
            raise InvalidSourceException(
                f"Expected ClickhouseConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    @staticmethod
    def get_schema_name(data: dict) -> str:
        """
        Method to fetch schema name from row data
        """
        schema = None
        if data.get("schema_name"):
            schema_list = ast.literal_eval(data["schema_name"])
            schema = schema_list[0] if len(schema_list) == 1 else None
        return schema

    def get_sql_statement(self, start_time: datetime, end_time: datetime) -> str:
        """
        returns sql statement to fetch query logs
        """
        return self.sql_stmt.format(
            start_time=start_time,
            end_time=end_time,
            filters=self.filters,  # pylint: disable=no-member
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
            database_name_list.append(database.name.__root__)
            if self.schema_field and database.databaseSchemas:
                for schema in database.databaseSchemas.__root__:
                    schema_name_list.append(schema.name)

        if self.schema_field and schema_name_list:
            self.filters += (  # pylint: disable=no-member
                f" AND hasAny({self.schema_field}, ['"
                + "','".join(schema_name_list)
                + "'])"
            )
