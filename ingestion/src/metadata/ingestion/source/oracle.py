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

# This import verifies that the dependencies are available.
from typing import Optional

import cx_Oracle  # noqa: F401
import pydantic

from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLConnectionConfig, SQLSource


class OracleConfig(SQLConnectionConfig):
    # defaults
    scheme = "oracle+cx_oracle"
    oracle_service_name: Optional[str] = None
    query: Optional[str] = "select * from {}.{} where ROWNUM <= 50"

    @pydantic.validator("oracle_service_name")
    def check_oracle_service_name(cls, v, values):
        if values.get("database") and v:
            raise ValueError(
                "Please provide database or oracle_service_name but not both"
            )
        return v

    def get_connection_url(self):
        url = super().get_connection_url()
        if self.oracle_service_name:
            assert not self.database
            url = f"{url}/?service_name={self.oracle_service_name}"
        return url


class OracleSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = OracleConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
