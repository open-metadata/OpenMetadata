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
"""
PowerBI source module
"""
from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.utils.powerbiBasicAuthConnection import (
    PowerBIBasicAuthConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.dashboard.powerbi.basic_auth_source import (
    PowerBIBasicAuthSource,
)
from metadata.ingestion.source.dashboard.powerbi.service_account_source import (
    PowerBIServiceAccountSource,
)


class PowerbiSource:
    """
    Powerbi Source Class
    """

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = WorkflowSource.parse_obj(config_dict)
        connection: PowerBIConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, PowerBIConnection):
            raise InvalidSourceException(
                f"Expected PowerBIConnection, but got {connection}"
            )
        if isinstance(connection.powerbiAuthType, PowerBIBasicAuthConnection):
            return PowerBIBasicAuthSource(config, metadata_config)
        return PowerBIServiceAccountSource(config, metadata_config)
