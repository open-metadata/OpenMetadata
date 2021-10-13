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

from collections import namedtuple
import pymysql  # noqa: F401

# This import verifies that the dependencies are available.
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.api.source import SourceStatus
from .sql_source import SQLConnectionConfig, SQLSource
from ..ometa.openmetadata_rest import MetadataServerConfig

TableKey = namedtuple("TableKey", ["schema", "table_name"])


class PostgresSourceConfig(SQLConnectionConfig):
    # defaults
    scheme = "postgresql+psycopg2"
    service_name = "postgres"
    service_type = "Postgres"

    def get_service_type(self) -> DatabaseServiceType:
        return DatabaseServiceType[self.service_type]

    def get_connection_url(self):
        return super().get_connection_url()


class PostgresSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = PostgresSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)

    def get_status(self) -> SourceStatus:
        return self.status
