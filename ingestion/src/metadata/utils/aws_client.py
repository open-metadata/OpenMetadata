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

from metadata.config.common import ConfigModel


class AWSClientConfigModel(ConfigModel):
    """
    AWSClientConfigModel holds all config parameters required to instantiate an AWSClient.
    """

    aws_access_key_id: Optional[str]
    aws_secret_access_key: Optional[str]
    aws_session_token: Optional[str]
    endpoint_url: Optional[str]
    region_name: Optional[str]


class AWSClient:
    """
    AWSClient creates a boto3 Session client based on AWSClientConfigModel.
    """

    config: AWSClientConfigModel

    def __init__(self, config: AWSClientConfigModel):
        self.config = config

    def _get_session(self) -> Session:
        if (
            self.config.aws_access_key_id
            and self.config.aws_secret_access_key
            and self.config.aws_session_token
        ):
            return Session(
                aws_access_key_id=self.config.aws_access_key_id,
                aws_secret_access_key=self.config.aws_secret_access_key,
                aws_session_token=self.config.aws_session_token,
                region_name=self.config.region_name,
            )
        if self.config.aws_access_key_id and self.config.aws_secret_access_key:
            return Session(
                aws_access_key_id=self.config.aws_access_key_id,
                aws_secret_access_key=self.config.aws_secret_access_key,
                region_name=self.config.region_name,
            )
        if self.config.region_name:
            return Session(region_name=self.config.region_name)
        return Session()

    def get_client(self, service_name: str) -> Any:
        session = self._get_session()
        if self.config.endpoint_url is not None:
            return session.client(
                service_name=service_name, endpoint_url=self.config.endpoint_url
            )
        return session.client(service_name=service_name)

    def get_resource(self, service_name: str) -> Any:
        session = self._get_session()
        if self.config.endpoint_url is not None:
            return session.resource(
                service_name=service_name, endpoint_url=self.config.endpoint_url
            )
        return session.resource(service_name=service_name)
