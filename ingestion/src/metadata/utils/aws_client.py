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

from typing import Any, Optional

from boto3 import Session
from pydantic import SecretStr

from metadata.config.common import ConfigModel


class AWSClientConfigModel(ConfigModel):
    """
    AWSClientConfigModel holds all config parameters required to instantiate an AWSClient.
    """

    awsAccessKeyId: Optional[str]
    awsSecretAccessKey: Optional[SecretStr]
    awsSessionToken: Optional[str]
    endPointURL: Optional[str]
    awsRegion: Optional[str]


class AWSClient:
    """
    AWSClient creates a boto3 Session client based on AWSClientConfigModel.
    """

    config: AWSClientConfigModel

    def __init__(self, config: AWSClientConfigModel):

        self.config = config

    def _get_session(self) -> Session:
        if (
            self.config.awsAccessKeyId
            and self.config.awsSecretAccessKey
            and self.config.awsSessionToken
        ):
            return Session(
                aws_access_key_id=self.config.awsAccessKeyId,
                aws_secret_access_key=self.config.awsSecretAccessKey.get_secret_value(),
                aws_session_token=self.config.awsSessionToken,
                region_name=self.config.awsRegion,
            )
        if self.config.awsAccessKeyId and self.config.awsSecretAccessKey:
            return Session(
                aws_access_key_id=self.config.awsAccessKeyId,
                aws_secret_access_key=self.config.awsSecretAccessKey.get_secret_value(),
                region_name=self.config.awsRegion,
            )
        if self.config.awsRegion:
            return Session(region_name=self.config.awsRegion)
        return Session()

    def get_client(self, service_name: str) -> Any:
        session = self._get_session()
        if self.config.endPointURL is not None:
            return session.client(
                service_name=service_name, endpoint_url=self.config.endPointURL
            )
        return session.client(service_name=service_name)

    def get_resource(self, service_name: str) -> Any:
        session = self._get_session()
        if self.config.endPointURL is not None:
            return session.resource(
                service_name=service_name, endpoint_url=self.config.endPointURL
            )
        return session.resource(service_name=service_name)
