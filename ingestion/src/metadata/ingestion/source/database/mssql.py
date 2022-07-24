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
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.connections import get_connection
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class MssqlSource(CommonDbSourceService):
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
        return cls(config, metadata_config)

    def get_database_names(self) -> Iterable[str]:
        configured_db = self.config.serviceConnection.__root__.config.database
        if configured_db:
            self.set_inspector(database_name=configured_db)
            yield configured_db
        else:
            results = self.connection.execute(
                "SELECT name FROM master.sys.databases order by name"
            )
            for res in results:
                row = list(res)
                new_database = row[0]

                if filter_by_database(
                    self.source_config.databaseFilterPattern, database_name=row[0]
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
