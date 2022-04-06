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

from typing import Iterable

from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataServerConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.sql_source import SQLSource


class MysqlSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: MysqlConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, MysqlConnection):
            raise InvalidSourceException(
                f"Expected MysqlConnection, but got {connection}"
            )

        return cls(config, metadata_config)

    def prepare(self):
        self.inspector = inspect(self.engine)
        self.service_connection.database = "default"
        return super().prepare()

    def next_record(self) -> Iterable[Entity]:
        for schema in self.inspector.get_schema_names():
            self.database_source_state.clear()
            if (
                self.source_config.schemaFilterPattern
                and schema not in self.source_config.schemaFilterPattern.includes
            ):
                self.status.filter(schema, "Schema pattern not allowed")
                continue

            # Fetch tables by default
            yield from self.fetch_tables(self.inspector, schema)

            if self.source_config.includeViews:
                yield from self.fetch_views(self.inspector, schema)
            if self.source_config.markDeletedTables:
                schema_fqdn = f"{self.config.serviceName}.{schema}"
                yield from self.delete_tables(schema_fqdn)
