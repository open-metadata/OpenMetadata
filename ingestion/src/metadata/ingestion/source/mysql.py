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
from metadata.ingestion.api.common import Entity
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class MySQLConfig(MysqlConnection, SQLConnectionConfig):
    def get_connection_url(self):
        return super().get_connection_url()


class MysqlSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataServerConfig):
        config = MySQLConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def prepare(self):
        self.inspector = inspect(self.engine)
        self.schema_names = (
            self.inspector.get_schema_names()
            if not self.config.database
            else [self.config.database]
        )
        return super().prepare()

    def next_record(self) -> Iterable[Entity]:
        for schema in self.schema_names:
            self.database_source_state.clear()
            if not self.sql_config.schema_filter_pattern.included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            if self.config.include_tables:
                yield from self.fetch_tables(self.inspector, schema)
            if self.config.include_views:
                yield from self.fetch_views(self.inspector, schema)
            if self.config.mark_deleted_tables_as_deleted:
                schema_fqdn = f"{self.config.service_name}.{schema}"
                yield from self.delete_tables(schema_fqdn)
