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
Module containing AWS Client
"""
from enum import Enum
from typing import Any

import boto3
from boto3 import Session

from metadata.utils.logger import utils_logger

logger = utils_logger()


class AWSServices(Enum):
    DYNAMO_DB = "dynamodb"
    GLUE = "glue"
    SAGEMAKER = "sagemaker"
    KINESIS = "kinesis"
    QUICKSIGHT = "quicksight"


class AWSClient:
    """
    AWSClient creates a boto3 Session client based on AWSCredentials.
    """

    def __init__(self, config: "AWSCredentials"):
        # local import to avoid the creation of circular dependencies with CustomSecretStr
        from metadata.generated.schema.security.credentials.awsCredentials import (  # pylint: disable=import-outside-toplevel
            AWSCredentials,
        )

        self.config = (
            config
            if isinstance(config, AWSCredentials)
            else (AWSCredentials.parse_obj(config) if config else config)
        )

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
        # initialize the client depending on the AWSCredentials passed
        if self.config is not None:
            logger.info(f"Getting AWS client for service [{service_name}]")
            session = self._get_session()
            if self.config.endPointURL is not None:
                return session.client(
                    service_name=service_name, endpoint_url=self.config.endPointURL
                )
            return session.client(service_name=service_name)

        logger.info(f"Getting AWS default client for service [{service_name}]")
        # initialized with the credentials loaded from running machine
        return boto3.client(service_name=service_name)

    def get_resource(self, service_name: str) -> Any:
        session = self._get_session()
        if self.config.endPointURL is not None:
            return session.resource(
                service_name=service_name, endpoint_url=self.config.endPointURL
            )
        return session.resource(service_name=service_name)

    def get_dynamo_client(self):
        return self.get_resource(AWSServices.DYNAMO_DB.value)

    def get_glue_client(self):
        return self.get_client(AWSServices.GLUE.value)

    def get_sagemaker_client(self):
        return self.get_client(AWSServices.SAGEMAKER.value)

    def get_kinesis_client(self):
        return self.get_client(AWSServices.KINESIS.value)

    def get_quicksight_client(self):
        return self.get_client(AWSServices.QUICKSIGHT.value)
