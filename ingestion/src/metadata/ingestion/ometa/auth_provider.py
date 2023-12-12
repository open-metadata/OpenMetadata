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
Interface definition for an Auth provider
"""
import os.path
from datetime import datetime

from dateutil.relativedelta import relativedelta

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)


class OpenMetadataAuthenticationProvider:
    """
    OpenMetadata authentication implementation

    Args:
        config (MetadataServerConfig):

    Attributes:
        config (MetadataServerConfig)
    """

    def __init__(self, config: OpenMetadataConnection):
        self.config = config
        self.security_config: OpenMetadataJWTClientConfig = self.config.securityConfig
        self.jwt_token = None
        self.expiry = datetime.now() - relativedelta(years=1)

    @classmethod
    def create(cls, config: OpenMetadataConnection):
        return cls(config)

    def auth_token(self) -> None:
        if not self.jwt_token:
            if os.path.isfile(self.security_config.jwtToken.get_secret_value()):
                with open(
                    self.security_config.jwtToken.get_secret_value(),
                    "r",
                    encoding="utf-8",
                ) as file:
                    self.jwt_token = file.read().rstrip()
            else:
                self.jwt_token = self.security_config.jwtToken.get_secret_value()

    def get_access_token(self):
        self.auth_token()
        return self.jwt_token, self.expiry
