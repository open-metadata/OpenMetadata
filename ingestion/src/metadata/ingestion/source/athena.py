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

from urllib.parse import quote_plus

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class AthenaConfig(AthenaConnection, SQLConnectionConfig):
    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username:
            url += f"{quote_plus(self.username)}"
            if self.password:
                url += f":{quote_plus(self.password)}"
        else:
            url += ":"
        url += f"@athena.{self.awsRegion}.amazonaws.com:443/"
        if self.database:
            url += f"{self.database}"
        url += f"?s3_staging_dir={quote_plus(self.s3StagingDir)}"
        url += f"&work_group={self.workgroup}"

        return url


class AthenaSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config = AthenaConfig.parse_obj(config_dict)
        return cls(config, metadata_config)
