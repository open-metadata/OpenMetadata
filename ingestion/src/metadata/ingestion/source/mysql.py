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
    Source as MetadataIngestionSourceConfig,
)
from metadata.generated.schema.metadataIngestion.workflow import SourceConfig
from metadata.ingestion.api.common import Entity
from metadata.ingestion.source.sql_source import SQLSource


class MysqlSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict):
        config = MetadataIngestionSourceConfig.parse_obj(config_dict)
        metadata_config = OpenMetadataServerConfig.parse_obj(metadata_config_dict)
        # Added parsing of MysqlConnection in order to validate config with pydantic models
        # Missing / Extra fields will throw errors
        MysqlConnection.parse_obj(config_dict.get("serviceConnection").get("config"))
        SourceConfig.parse_obj(config_dict.get("sourceConfig"))
        return cls(config, metadata_config)

    def prepare(self):
        self.inspector = inspect(self.engine)
        self.schema_names = (
            self.inspector.get_schema_names()
            if not self.sql_config["serviceConnection"]["config"].get("database")
            else [self.sql_config["serviceConnection"]["config"]["database"]]
        )
        return super().prepare()

    def next_record(self) -> Iterable[Entity]:
        for schema in self.schema_names:
            self.database_source_state.clear()
            if self.source_config.get("schemaFilterPattern") and not self.source_config[
                "schemaFilterPattern"
            ].included(schema):
                self.status.filter(schema, "Schema pattern not allowed")
                continue
            if self.source_config.get("includeTables", True):
                yield from self.fetch_tables(self.inspector, schema)
            if self.source_config.get("includeViews", True):
                yield from self.fetch_views(self.inspector, schema)
            if self.source_config.get("markDeletedTables", True):
                schema_fqdn = f"{self.config.serviceName}.{schema}"
                yield from self.delete_tables(schema_fqdn)
