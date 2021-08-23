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

# This import verifies that the dependencies are available.
import sqlalchemy_pytds  # noqa: F401

from .sql_source import SQLConnectionConfig, SQLSource
from ..ometa.auth_provider import MetadataServerConfig


class MssqlConfig(SQLConnectionConfig):
    host_port = "localhost:1433"
    scheme = "mssql+pytds"

    def get_connection_url(self):
        return super().get_connection_url()

    def fetch_sample_data(self, schema: str, table: str, connection):
        return super().fetch_sample_data(schema, table, connection)


class MssqlSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = MssqlConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
