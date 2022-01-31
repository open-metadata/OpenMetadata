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
"""Trino source module"""

import logging
import sys
from typing import Iterable
from urllib.parse import quote_plus

import click
from sqlalchemy.inspection import inspect

from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig

logger = logging.getLogger(__name__)


class TrinoConfig(SQLConnectionConfig):
    """Trinio config class -- extends SQLConnectionConfig class

    Attributes:
        host_port:
        scheme:
        service_type:
        catalog:
        database:
    """

    host_port = "localhost:8080"
    scheme = "trino"
    service_type = "Trino"
    catalog: str
    database: str

    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username is not None:
            url += f"{self.username}"
            if self.password is not None:
                url += f":{quote_plus(self.password.get_secret_value())}"
            url += "@"
        url += f"{self.host_port}"
        if self.catalog is not None:
            url += f"/{self.catalog}"
            if self.database is not None:
                url += f"/{self.database}"

        if self.options is not None:
            if self.database is None:
                url += "/"
            params = "&".join(
                f"{key}={quote_plus(value)}"
                for (key, value) in self.options.items()
                if value
            )
            url = f"{url}?{params}"
        return url


class TrinoSource(SQLSource):
    """Trino source -- extends SQLSource

    Args:
        config:
        metadata_config:
        ctx
    """

    def __init__(self, config, metadata_config, ctx):
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

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        inspector = inspect(self.engine)
        if self.config.include_tables:
            yield from self.fetch_tables(inspector, self.config.database)
        if self.config.include_views:
            yield from self.fetch_views(inspector, self.config.database)
