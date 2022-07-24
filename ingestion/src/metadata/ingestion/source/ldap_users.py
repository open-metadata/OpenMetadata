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

from typing import Iterable

from ldap3 import ALL, LEVEL, Connection, Server

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.source import Source, SourceStatus
from metadata.ingestion.models.user import OMetaUserProfile
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class LDAPUserConfig(ConfigModel):
    server: str
    username: str
    password: str


class LdapUsersSource(Source[OMetaUserProfile]):
    config: LDAPUserConfig
    status: SourceStatus

    def __init__(
        self,
        config: LDAPUserConfig,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.status = SourceStatus()
        self.wrote_something = False
        self.headers = {"Content-type": "application/json"}
        self.users = self._load_users(self.ldap_connection())

    def prepare(self):
        pass

    @staticmethod
    def _load_users(conn):
        if conn:
            conn.search(
                search_base="ou=users,dc=example,dc=com",
                search_filter="(objectClass=inetOrgPerson)",
                search_scope=LEVEL,
                attributes=["cn", "givenName", "uid", "mail", "sn"],
            )
            arr = []
            for entry in conn.response:
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
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = LDAPUserConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def next_record(self) -> Iterable[OMetaUserProfile]:
        for user in self.users:
            user_metadata = CreateUserRequest(
                email=user["attributes"]["mail"][0],
                displayName=user["attributes"]["cn"][0],
                name=user["attributes"]["givenName"][0],
            )
            self.status.scanned(user_metadata.name)
            yield OMetaUserProfile(user=user_metadata)

    def get_status(self) -> SourceStatus:
        return self.status

    def close(self):
        pass

    def test_connection(self) -> None:
        pass
