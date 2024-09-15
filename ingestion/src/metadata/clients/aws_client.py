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
from typing import Any, Optional

import boto3
from boto3 import Session
from pydantic import BaseModel

from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.utils.logger import utils_logger

logger = utils_logger()


class AWSServices(Enum):
    S3 = "s3"
    CLOUDWATCH = "cloudwatch"
    DYNAMO_DB = "dynamodb"
    GLUE = "glue"
    SAGEMAKER = "sagemaker"
    KINESIS = "kinesis"
    QUICKSIGHT = "quicksight"
    ATHENA = "athena"
    RDS = "rds"
    LAKE_FORMATION = "lakeformation"


class AWSAssumeRoleException(Exception):
    """
    Exception class to handle assume role related issues
    """


class AWSAssumeRoleCredentialWrapper(BaseModel):
    accessKeyId: str
    secretAccessKey: CustomSecretStr
    sessionToken: Optional[str] = None


class AWSClient:
    """
    AWSClient creates a boto3 Session client based on AWSCredentials.
    """

    def __init__(self, config: "AWSCredentials"):
        self.config = (
            config
            if isinstance(config, AWSCredentials)
            else (AWSCredentials.model_validate(config) if config else config)
        )

    @staticmethod
    def get_assume_role_config(
        config: AWSCredentials,
    ) -> Optional[AWSAssumeRoleCredentialWrapper]:
        """
        Get temporary credentials from assumed role
        """
        session = AWSClient._get_session(
            config.awsAccessKeyId,
            config.awsSecretAccessKey,
            config.awsSessionToken,
            config.awsRegion,
            config.profileName,
        )
        sts_client = session.client("sts")
        if config.assumeRoleSourceIdentity:
            resp = sts_client.assume_role(
                RoleArn=config.assumeRoleArn,
                RoleSessionName=config.assumeRoleSessionName,
                SourceIdentity=config.assumeRoleSourceIdentity,
            )
        else:
            resp = sts_client.assume_role(
                RoleArn=config.assumeRoleArn,
                RoleSessionName=config.assumeRoleSessionName,
            )

        if resp:
            credentials = resp.get("Credentials", {})
            return AWSAssumeRoleCredentialWrapper(
                accessKeyId=credentials.get("AccessKeyId"),
                secretAccessKey=credentials.get("SecretAccessKey"),
                sessionToken=credentials.get("SessionToken"),
            )
        return None

    @staticmethod
    def _get_session(
        aws_access_key_id: Optional[str],
        aws_secret_access_key: Optional[CustomSecretStr],
        aws_session_token: Optional[str],
        aws_region: str,
        profile=None,
    ) -> Session:
        """
        The only required param for boto3 is the region.
        The rest of credentials will have fallback strategies based on
        https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials
        """
        return Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key.get_secret_value()
            if aws_secret_access_key
            else None,
            aws_session_token=aws_session_token,
            region_name=aws_region,
            profile_name=profile,
        )

    def create_session(self) -> Session:
        if self.config.assumeRoleArn:
            assume_creds = AWSClient.get_assume_role_config(self.config)
            if assume_creds:
                return AWSClient._get_session(
                    assume_creds.accessKeyId,
                    assume_creds.secretAccessKey,
                    assume_creds.sessionToken,
                    self.config.awsRegion,
                    self.config.profileName,
                )

        return AWSClient._get_session(
            self.config.awsAccessKeyId,
            self.config.awsSecretAccessKey,
            self.config.awsSessionToken,
            self.config.awsRegion,
            self.config.profileName,
        )

    def get_client(self, service_name: str) -> Any:
        # initialize the client depending on the AWSCredentials passed
        if self.config is not None:
            logger.info(f"Getting AWS client for service [{service_name}]")
            session = self.create_session()
            if self.config.endPointURL is not None:
                return session.client(
                    service_name=service_name, endpoint_url=str(self.config.endPointURL)
                )
            return session.client(service_name=service_name)

        logger.info(f"Getting AWS default client for service [{service_name}]")
        # initialized with the credentials loaded from running machine
        return boto3.client(service_name=service_name)

    def get_resource(self, service_name: str) -> Any:
        session = self.create_session()
        if self.config.endPointURL is not None:
            return session.resource(
                service_name=service_name, endpoint_url=str(self.config.endPointURL)
            )
        return session.resource(service_name=service_name)

    def get_rds_client(self):
        return self.get_client(AWSServices.RDS.value)

    def get_s3_client(self):
        return self.get_client(AWSServices.S3.value)

    def get_cloudwatch_client(self):
        return self.get_client(AWSServices.CLOUDWATCH.value)

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

    def get_athena_client(self):
        return self.get_client(AWSServices.ATHENA.value)

    def get_lake_formation_client(self):
        return self.get_client(AWSServices.LAKE_FORMATION.value)
