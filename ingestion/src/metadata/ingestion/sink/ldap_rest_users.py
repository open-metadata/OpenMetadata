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

import logging
from typing import Generic

from pydantic import BaseModel

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.teams.createUser import CreateUserEntityRequest
from metadata.generated.schema.entity.teams.user import User
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig

logger = logging.getLogger(__name__)


class LDAPSourceConfig(ConfigModel):
    api_end_point: str


class LdapRestUsersSink(Sink[User]):
    config: LDAPSourceConfig
    status: SinkStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: LDAPSourceConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.api_users = "/users"
        self.rest = OpenMetadata(metadata_config).client

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = LDAPSourceConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, record: User) -> None:
        self._create_user(record)

    def _create_user(self, record: User) -> None:
        metadata_user = CreateUserEntityRequest(
            name=record.name, displayName=record.displayName, email=record.email
        )
        self.rest.post(self.api_users, data=metadata_user.json())
        self.status.records_written(record.name[0])

    def get_status(self):
        return self.status

    def close(self):
        pass
