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
"""MSSQL source module"""

from typing import Iterable

from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.sql_source import SQLSource
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MssqlSource(SQLSource):
    """MSSQL Source class

    Args:
        config:
        metadata_config:
        ctx
    """

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: MssqlConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MssqlConnection):
            raise InvalidSourceException(
                f"Expected MssqlConnection, but got {connection}"
            )
        if config.sourceConfig.config.sampleDataQuery == "select * from {}.{} limit 50":
            config.sourceConfig.config.sampleDataQuery = (
                "select top 50 * from [{}].[{}]"
            )
        return cls(config, metadata_config)

    def get_databases(self) -> Iterable[Inspector]:
        if self.service_connection.database:
            yield from super().get_databases()
        else:
            query = "SELECT name FROM master.sys.databases order by name;"
            results = self.connection.execute(query)
            db_list = []

            for res in results:
                db_list.append(list(res))

            for row in db_list:
                try:
                    if filter_by_database(
                        self.source_config.databaseFilterPattern, database_name=row[0]
                    ):
                        self.status.filter(row[0], "Database pattern not allowed")
                        continue
                    logger.info(f"Ingesting from database: {row[0]}")
                    self.service_connection.database = row[0]
                    self.engine = get_connection(
                        self.config.serviceConnection.__root__.config
                    )
                    self.engine.connect()
                    yield inspect(self.engine)
                except Exception as err:
                    logger.error(f"Failed to Connect: {row[0]} due to error {err}")
