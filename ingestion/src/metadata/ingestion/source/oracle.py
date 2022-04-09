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

# This import verifies that the dependencies are available.

import cx_Oracle  # noqa: F401
import pydantic

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class OracleSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config = WorkflowSource.parse_obj(config_dict)
        connection: OracleConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, OracleConnection):
            raise InvalidSourceException(
                f"Expected OracleConnection, but got {connection}"
            )
        if config.sourceConfig.config.sampleDataQuery == "select * from {}.{} limit 50":
            config.sourceConfig.config.sampleDataQuery = (
                "select * from {}.{} where ROWNUM <= 50"
            )
        return cls(config, metadata_config)

    def _get_database(self, database: str) -> Database:
        if not database:
            database = self.service_connection.oracleServiceName
        return Database(
            name=database,
            service=EntityReference(
                id=self.service.id, type=self.service_connection.type.value
            ),
        )
