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

from metadata.generated.schema.entity.services.connections.database.singleStoreConnection import (
    SingleStoreConnection,
)
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.ingestion.source.sql_source import SQLSource
from metadata.ingestion.source.sql_source_common import SQLConnectionConfig


class SingleStoreConfig(SingleStoreConnection, SQLConnectionConfig):
    def get_connection_url(self):
        return super().get_connection_url()


class SinglestoreSource(SQLSource):
    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)

    @classmethod
    def create(cls, config_dict, metadata_config_dict):
        config = SingleStoreConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(config, metadata_config)
