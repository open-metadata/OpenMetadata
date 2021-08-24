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

import logging

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.models.user import MetadataTeam, MetadataUser
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST, APIError

logger = logging.getLogger(__name__)


class MetadataUsersSinkConfig(ConfigModel):
    api_end_point: str = None


class MetadataRestUsersSink(Sink):
    config: MetadataUsersSinkConfig
    metadata_config: MetadataServerConfig
    status: SinkStatus

    def __init__(self, ctx: WorkflowContext, config: MetadataUsersSinkConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.api_team_post = "/teams"
        self.api_team_get = "/teams"
        self.api_users = "/users"
        self.org_entities = {}
        self.role_entities = {}
        self.team_entities = {}
        self.rest = REST(metadata_config)
        self._bootstrap_entities()

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = MetadataUsersSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def write_record(self, record: Record) -> None:
        self._create_user(record)

    def _bootstrap_entities(self):
        # Fetch teams per org

        team_response = self.rest.get(self.api_team_get)
        for team in team_response['data']:
            self.team_entities[team['displayName']] = team['id']

    def _create_team(self, record: MetadataUser) -> None:
        team_name = record.team_name
        metadata_team = MetadataTeam(team_name, 'Team Name')
        try:
            r = self.rest.post(self.api_team_post,
                               data=metadata_team.to_json()
                               )
            instance_id = r['id']
            self.team_entities[team_name] = instance_id
        except APIError:
            pass

    def _create_user(self, record: MetadataUser) -> None:
        if record.team_name not in self.team_entities:
            self._create_team(record)
        teams = [self.team_entities[record.team_name]]
        # Using github username for generating a login name
        metadata_user = MetadataUser(name=record.github_username,
                                     display_name=record.name,
                                     email=record.email,
                                     teams=teams)
        try:
            self.rest.post(self.api_users, data=metadata_user.to_json())
            self.status.records_written(record.github_username)
            logger.info("Sink: {}".format(record.github_username))
        except APIError:
            pass

    def get_status(self) -> SinkStatus:
        return self.status

    def close(self):
        self.rest.close()
