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

from collections import namedtuple
from typing import Iterable

from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)

# This import verifies that the dependencies are available.
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

TableKey = namedtuple("TableKey", ["schema", "table_name"])

logger = ingestion_logger()


class PostgresSource(CommonDbSourceService):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.pgconn = self.engine.raw_connection()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: PostgresConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PostgresConnection):
            raise InvalidSourceException(
                f"Expected PostgresConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.__root__.config.database
        if configured_db:
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            results = self.connection.execute(
                "select datname from pg_catalog.pg_database"
            )
            for res in results:
                row = list(res)
                new_database = row[0]

                if filter_by_database(
                    self.source_config.databaseFilterPattern, database_name=new_database
                ):
                    self.status.filter(new_database, "Database pattern not allowed")
                    continue

                try:
                    self.set_inspector(database_name=new_database)
                    yield new_database
                except Exception as err:
                    logger.error(
                        f"Error trying to connect to database {new_database} - {err}"
                    )

    def is_partition(self, table_name: str, schema_name: str, inspector) -> bool:
        cur = self.pgconn.cursor()
        cur.execute(
            """
                SELECT relispartition as is_partition
                FROM   pg_catalog.pg_class c
                JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE  c.relname = %s
                  AND  n.nspname = %s
            """,
            (table_name, schema_name),
        )
        obj = cur.fetchone()
        is_partition = obj[0] if obj else False
        return is_partition

    def type_of_column_name(self, sa_type, table_name: str, column_name: str):
        cur = self.pgconn.cursor()
        schema_table = table_name.split(".")
        cur.execute(
            """select data_type, udt_name
               from information_schema.columns
               where table_schema = %s and table_name = %s and column_name = %s""",
            (schema_table[0], schema_table[1], column_name),
        )
        pgtype = cur.fetchone()[1]
        if pgtype == "geometry" or pgtype == "geography":
            return "GEOGRAPHY"
        return sa_type
