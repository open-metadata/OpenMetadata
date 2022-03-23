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

import logging
import sys
from typing import Iterable, Optional
from urllib.parse import quote_plus

import click
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig

logger = logging.getLogger(__name__)


class TrinoConfig(SQLConnectionConfig):
    host_port = "localhost:8080"
    scheme = "trino"
    service_type = DatabaseServiceType.Trino.value
    catalog: str
    include_views = False
    params: Optional[dict] = None

    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username:
            url += f"{quote_plus(self.username)}"
            if self.password:
                url += f":{quote_plus(self.password.get_secret_value())}"
            url += "@"
        url += f"{self.host_port}"
        url += f"/{self.catalog}"
        if self.params is not None:
            params = "&".join(
                f"{key}={quote_plus(value)}"
                for (key, value) in self.params.items()
                if value
            )
            url = f"{url}?{params}"
        return url


class TrinoSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        self.schema_names = None
        self.inspector = None
        try:
            from sqlalchemy_trino import (
                dbapi,  # pylint: disable=import-outside-toplevel,unused-import
            )
        except ModuleNotFoundError:
            click.secho(
                "Trino source dependencies are missing. Please run\n"
                + "$ pip install --upgrade 'openmetadata-ingestion[trino]'",
                fg="red",
            )
            if logger.isEnabledFor(logging.DEBUG):
                raise
            sys.exit(1)
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = TrinoConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def prepare(self):
        self.inspector = inspect(self.engine)
        self.schema_names = (
            self.inspector.get_schema_names()
            if not self.config.database
            else [self.config.database]
        )
        return super().prepare()

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
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
