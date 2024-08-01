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
Superset source module
"""
from typing import Optional

from metadata.generated.schema.entity.services.connections.dashboard.supersetConnection import (
    SupersetConnection,
)
from metadata.generated.schema.entity.utils.supersetApiConnection import (
    SupersetApiConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.superset.api_source import SupersetAPISource
from metadata.ingestion.source.dashboard.superset.db_source import SupersetDBSource


class SupersetSource:
    """
    Superset Source Class
    """

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: SupersetConnection = config.serviceConnection.root.config
        if not isinstance(connection, SupersetConnection):
            raise InvalidSourceException(
                f"Expected SupersetConnection, but got {connection}"
            )
        if isinstance(connection.connection, SupersetApiConnection):
            return SupersetAPISource(config, metadata)
        return SupersetDBSource(config, metadata)
