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

from typing import Iterable, Optional
from urllib.parse import quote_plus

from sqlalchemy.inspection import inspect

from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable

from ..ometa.openmetadata_rest import MetadataServerConfig
from .sql_source import SQLConnectionConfig, SQLSource


class TrinoConfig(SQLConnectionConfig):
    host_port = "localhost:8080"
    scheme = "trino"
    service_type = "Trino"
    catalog: str
    schema_name: Optional[str]

    def get_connection_url(self):
        url = f"{self.scheme}://{self.host_port}"
        if self.catalog:
            url += f"/{quote_plus(self.catalog)}"
            if self.schema_name:
                url += f"/{quote_plus(self.schema_name)}"
        if self.username:
            url += f"?user={quote_plus(self.username)}"
            if self.password:
                url += f"&password={quote_plus(self.password)}"
        return url


class TrinoSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = TrinoConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def next_record(self) -> Iterable[OMetaDatabaseAndTable]:
        inspector = inspect(self.engine)
        if self.config.include_tables:
            yield from self.fetch_tables(inspector, self.config.schema_name)
        if self.config.include_views:
            yield from self.fetch_views(inspector, self.config.schema_name)
