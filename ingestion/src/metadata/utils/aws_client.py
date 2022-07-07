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

from typing import Any

from boto3 import Session

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.utils.connection_clients import (
    DynamoClient,
    GlueDBClient,
    GluePipelineClient,
)


class AWSClient:
    """
    AWSClient creates a boto3 Session client based on AWSCredentials.
    """

    config: AWSCredentials

    def __init__(self, config: AWSCredentials):

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

    def get_dynomo_client(self) -> DynamoClient:
        return DynamoClient(self.get_resource("dynamodb"))

    def get_glue_db_client(self) -> GlueDBClient:
        return GlueDBClient(self.get_client("glue"))

    def get_glue_pipeline_client(self) -> GluePipelineClient:
        return GluePipelineClient(self.get_client("glue"))
