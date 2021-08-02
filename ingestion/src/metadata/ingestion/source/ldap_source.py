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
from typing import Iterable
from ldap3 import Server, Connection, ALL, LEVEL

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import WorkflowContext
from metadata.ingestion.api.source import SourceStatus, Source
from metadata.ingestion.models.user import MetadataUser, User
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig

logger = logging.getLogger(__name__)


class LDAPUserConfig(ConfigModel):
    server: str
    username: str
    password: str


class LDAPUserSource(Source):
    config: LDAPUserConfig
    status: SourceStatus

    def __init__(self, ctx: WorkflowContext, config: LDAPUserConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()
        self.wrote_something = False
        self.headers = {'Content-type': 'application/json'}
        self.users = self._load_users(self.ldap_connection())

    def prepare(self):
        pass

    def _load_users(self, c):
        if c is not False:
            c.search(search_base='ou=users,dc=example,dc=com',
                     search_filter='(objectClass=inetOrgPerson)',
                     search_scope=LEVEL,
                     attributes=['cn', 'givenName', 'uid', 'mail', 'sn'])
            arr = []
            for entry in c.response:
                arr.append(entry)
            return arr

    def ldap_connection(self):
        s = Server(self.config.server, get_info=ALL)
        c = Connection(s, user=self.config.username, password=self.config.password)
        c.open()
        if not c.bind():
            logger.info("LDAP Connection Unsuccessful")
            return False
        return c

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = LDAPUserConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def next_record(self) -> Iterable[MetadataUser]:
        for user in self.users:
            user_metadata = User(user['attributes']['mail'],
                                 user['attributes']['givenName'],
                                 user['attributes']['sn'],
                                 user['attributes']['cn'],
                                 user['attributes']['uid'],
                                 '', '', '', True,
                                 0)
            yield user_metadata

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass
