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

from typing import Optional

from snowflake.sqlalchemy import custom_types

from .sql_source import (
    SQLConnectionConfig,
    SQLSource,
)
from ..ometa.openmetadata_rest import MetadataServerConfig
from metadata.utils.helpers import register_custom_type
register_custom_type(custom_types.TIMESTAMP_TZ, "TIME")
register_custom_type(custom_types.TIMESTAMP_LTZ, "TIME")
register_custom_type(custom_types.TIMESTAMP_NTZ, "TIME")


class SnowflakeConfig(SQLConnectionConfig):
    scheme = "snowflake"
    account: str
    database: str  # database is required
    warehouse: Optional[str]
    role: Optional[str]
    duration: Optional[int]
    service_type = "Snowflake"

    def get_connection_url(self):
        connect_string = super().get_connection_url()
        options = {
            "account": self.account,
            "warehouse": self.warehouse,
            "role": self.role,
        }
        params = "&".join(f"{key}={value}" for (key, value) in options.items() if value)
        if params:
            connect_string = f"{connect_string}?{params}"
        return connect_string

    


class SnowflakeSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = SnowflakeConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
