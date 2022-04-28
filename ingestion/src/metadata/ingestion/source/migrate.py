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
"""Metadata source module"""

import logging

from metadata.generated.schema.entity.policies.policy import Policy
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException, SourceStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.metadata import MetadataSource

logger = logging.getLogger(__name__)


class Policy:

    policy_dict: dict

    def __init__(self, policy_dict) -> None:
        self.policy_dict = policy_dict


class MigrateSource(MetadataSource):
    """OpenmetadataSource class

    Args:
        config:
        metadata_config:

    Attributes:
        config:
        report:
        metadata_config:
        status:
        wrote_something:
        metadata:
        tables:
        topics:
    """

    config: WorkflowSource
    report: SourceStatus

    def __init__(
        self,
        config: WorkflowSource,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__(config, metadata_config)
        self.metadata = OpenMetadata(
            OpenMetadataConnection.parse_obj(self.service_connection)
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: OpenMetadataConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, OpenMetadataConnection):
            raise InvalidSourceException(
                f"Expected OpenMetadataConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    def fetch_policy(self) -> Policy:
        """fetch policy method

        Returns:
            Policy:
        """
        policy_entities = self.metadata.client.get("/policies")
        for policy in policy_entities.get("data"):
            yield Policy(policy)
