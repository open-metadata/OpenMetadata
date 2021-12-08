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

from typing import Optional
from urllib.parse import quote_plus

from pydantic import SecretStr

from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLConnectionConfig, SQLSource


class AthenaConfig(SQLConnectionConfig):
    scheme: str = "awsathena+rest"
    username: Optional[str] = None
    password: Optional[SecretStr] = None
    database: Optional[str] = None
    aws_region: str
    s3_staging_dir: str
    work_group: str

    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username:
            url += f"{quote_plus(self.username)}"
            if self.password:
                url += f":{quote_plus(self.password.get_secret_value())}"
        else:
            url += ":"
        url += f"@athena.{self.aws_region}.amazonaws.com:443/"
        if self.database:
            url += f"{self.database}"
        url += f"?s3_staging_dir={quote_plus(self.s3_staging_dir)}"
        url += f"&work_group={self.work_group}"

        return url


class AthenaSource(SQLSource):
    def __init__(self, config, metadata_config, ctx):
        super().__init__(config, metadata_config, ctx)

    @classmethod
    def create(cls, config_dict, metadata_config_dict, ctx):
        config = AthenaConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config, ctx)
