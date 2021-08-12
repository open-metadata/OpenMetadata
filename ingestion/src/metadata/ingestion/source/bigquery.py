#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from typing import Optional, Tuple

# This import verifies that the dependencies are available.

from .sql_source import SQLConnectionConfig, SQLSource
from ..ometa.auth_provider import MetadataServerConfig


class BigQueryConfig(SQLConnectionConfig, SQLSource):
    scheme = "bigquery"
    project_id: Optional[str] = None

    def get_connection_url(self):
        if self.project_id:
            return f"{self.scheme}://{self.project_id}"
        return f"{self.scheme}://"


class BigQuerySource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = BigQueryConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def standardize_schema_table_names(
            self, schema: str, table: str
    ) -> Tuple[str, str]:
        segments = table.split(".")
        if len(segments) != 2:
            raise ValueError(f"expected table to contain schema name already {table}")
        if segments[0] != schema:
            raise ValueError(f"schema {schema} does not match table {table}")
        return segments[0], segments[1]
