#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Module containing AWS Client
"""

import datetime
import threading
from enum import Enum
from functools import partial
from typing import Any, Callable, Dict, Optional, Type, TypeVar  # noqa: UP035
from urllib.parse import parse_qs, urlparse

import boto3
import botocore.session
from boto3 import Session
from botocore.credentials import RefreshableCredentials
from botocore.session import get_session
from pydantic import BaseModel, Field

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
    FIREHOSE = "firehose"
    QUICKSIGHT = "quicksight"
    ATHENA = "athena"
    RDS = "rds"
    REDSHIFT = "redshift"
    REDSHIFT_SERVERLESS = "redshift-serverless"
    LAKE_FORMATION = "lakeformation"
    MWAA = "mwaa"


def _get_valid_aws_regions() -> set:
    """Derive the valid AWS region set from botocore endpoint data."""
    session = botocore.session.get_session()
    regions = set()
    for partition in session.get_available_partitions():
        regions.update(session.get_available_regions("ec2", partition_name=partition))
    return regions


VALID_AWS_REGIONS = _get_valid_aws_regions()


class AWSAssumeRoleException(Exception):  # noqa: N818
    """
    Exception class to handle assume role related issues
    """


class AWSAssumeRoleCredentialResponse(BaseModel):
    AccessKeyId: str = Field()
    SecretAccessKey: str = Field()
    SessionToken: Optional[str] = Field(  # noqa: UP045
        default=None,
    )
    Expiration: Optional[datetime.datetime] = None  # noqa: UP045


class AWSAssumeRoleCredentialWrapper(BaseModel):
    accessKeyId: str = Field(alias="access_key")  # noqa: N815
    secretAccessKey: CustomSecretStr = Field(alias="secret_key")  # noqa: N815
    sessionToken: Optional[str] = Field(default=None, alias="token")  # noqa: N815, UP045
    expiryTime: Optional[str] = Field(alias="expiry_time")  # noqa: N815, UP045

    class Config:
        populate_by_name = True


AWSAssumeRoleCredentialFormat = TypeVar("AWSAssumeRoleCredentialFormat", AWSAssumeRoleCredentialWrapper, Dict)  # noqa: UP006


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
        if self.config and self.config.awsRegion:
            region = self.config.awsRegion
            if region not in VALID_AWS_REGIONS:
                msg = f"Invalid AWS Region: '{region}'."
                if any(region.startswith(r) and len(region) == len(r) + 1 for r in VALID_AWS_REGIONS):
                    msg += " This looks like an availability zone rather than a region."
                msg += f" Expected one of: {', '.join(sorted(VALID_AWS_REGIONS))}"
                raise ValueError(msg)

    @staticmethod
    def get_assume_role_config(
        config: AWSCredentials,
        return_type: Type[AWSAssumeRoleCredentialFormat] = AWSAssumeRoleCredentialWrapper,  # noqa: UP006
    ) -> Optional[AWSAssumeRoleCredentialFormat]:  # noqa: UP045
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
            credentials: AWSAssumeRoleCredentialResponse = AWSAssumeRoleCredentialResponse(
                **resp.get("Credentials", {})
            )
            creds_wrapper = AWSAssumeRoleCredentialWrapper(
                accessKeyId=credentials.AccessKeyId,
                secretAccessKey=credentials.SecretAccessKey,
                sessionToken=credentials.SessionToken,
                expiryTime=credentials.Expiration.isoformat(),
            )
            if return_type == Dict:  # noqa: UP006
                return creds_wrapper.model_dump(by_alias=True)
            return creds_wrapper

        return None

    @staticmethod
    def _get_session(
        aws_access_key_id: Optional[str],  # noqa: UP045
        aws_secret_access_key: Optional[CustomSecretStr],  # noqa: UP045
        aws_session_token: Optional[str],  # noqa: UP045
        aws_region: str,
        profile=None,
        refresh_using: Optional[Callable] = None,  # noqa: UP045
    ) -> Session:
        """
        The only required param for boto3 is the region.
        The rest of credentials will have fallback strategies based on
        https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html#configuring-credentials
        """
        if refresh_using:
            refreshable_creds = RefreshableCredentials.create_from_metadata(
                metadata=refresh_using(),
                refresh_using=refresh_using,
                method="sts-assume-role",
            )
            session = get_session()
            session._credentials = refreshable_creds  # pylint: disable=protected-access
            return Session(botocore_session=session, region_name=aws_region, profile_name=profile)

        return Session(
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=(aws_secret_access_key.get_secret_value() if aws_secret_access_key else None),
            aws_session_token=aws_session_token,
            region_name=aws_region,
            profile_name=profile,
        )

    def create_session(self) -> Session:
        if self.config.assumeRoleArn:
            return AWSClient._get_session(
                None,
                None,
                None,
                self.config.awsRegion,
                self.config.profileName,
                refresh_using=partial(AWSClient.get_assume_role_config, self.config, Dict),  # noqa: UP006
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
            logger.debug(f"Getting AWS client for service [{service_name}]")
            session = self.create_session()
            if self.config.endPointURL is not None:
                return session.client(service_name=service_name, endpoint_url=str(self.config.endPointURL))
            return session.client(service_name=service_name)

        logger.debug(f"Getting AWS default client for service [{service_name}]")
        # initialized with the credentials loaded from running machine
        return boto3.client(service_name=service_name)

    def get_resource(self, service_name: str) -> Any:
        session = self.create_session()
        if self.config.endPointURL is not None:
            return session.resource(service_name=service_name, endpoint_url=str(self.config.endPointURL))
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

    def get_firehose_client(self):
        return self.get_client(AWSServices.FIREHOSE.value)

    def get_quicksight_client(self):
        return self.get_client(AWSServices.QUICKSIGHT.value)

    def get_athena_client(self):
        return self.get_client(AWSServices.ATHENA.value)

    def get_lake_formation_client(self):
        return self.get_client(AWSServices.LAKE_FORMATION.value)

    def get_redshift_client(self):
        return self.get_client(AWSServices.REDSHIFT.value)

    def get_redshift_serverless_client(self):
        return self.get_client(AWSServices.REDSHIFT_SERVERLESS.value)

    def get_mwaa_client(self):
        return self.get_client(AWSServices.MWAA.value)


RDS_IAM_TOKEN_DEFAULT_TTL = datetime.timedelta(minutes=15)
RDS_IAM_TOKEN_REFRESH_THRESHOLD = datetime.timedelta(minutes=5)


class RdsIamAuthTokenManager:
    """
    Manages the lifecycle of an AWS RDS IAM authentication token.

    RDS IAM tokens are short-lived (~15 minutes) presigned URLs. A long ingestion
    that opens new pooled connections after the token expires would otherwise
    authenticate with a stale token and fail. This manager caches the current
    token, derives its expiry from the presigned URL, and regenerates it shortly
    before it lapses so every connection receives a valid token.
    """

    def __init__(
        self,
        host: str,
        port: str,
        username: str,
        aws_config: AWSCredentials,
        refresh_threshold: datetime.timedelta = RDS_IAM_TOKEN_REFRESH_THRESHOLD,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.aws_config = aws_config
        self.refresh_threshold = refresh_threshold
        self._token: Optional[str] = None  # noqa: UP045
        self._expires_at: Optional[datetime.datetime] = None  # noqa: UP045
        self._lock = threading.Lock()

    def get_token(self) -> str:
        """Return a valid token, refreshing if needed.

        The check-and-refresh is serialized: the engine shares one manager across
        all worker threads (each calls ``engine.connect()`` from the ``do_connect``
        listener), so without the lock multiple threads could refresh concurrently
        and observe a token paired with a stale expiry.
        """
        with self._lock:
            if self._needs_refresh():
                self._refresh_token()
            if self._token is None:
                raise RuntimeError("Failed to generate RDS IAM authentication token")
            return self._token

    def _needs_refresh(self) -> bool:
        needs_refresh = True
        if self._token is not None and self._expires_at is not None:
            time_left = self._expires_at - datetime.datetime.now(datetime.timezone.utc)
            needs_refresh = time_left <= self.refresh_threshold
        return needs_refresh

    def _refresh_token(self) -> None:
        logger.debug(f"Generating RDS IAM auth token for {self.username}@{self.host}")
        rds_client = AWSClient(config=self.aws_config).get_rds_client()
        token = rds_client.generate_db_auth_token(
            DBHostname=self.host,
            Port=self.port,
            DBUsername=self.username,
            Region=self.aws_config.awsRegion,
        )
        self._token = token
        self._expires_at = self._parse_token_expiry(token)

    def _parse_token_expiry(self, token: str) -> datetime.datetime:
        """Derive token expiry from the presigned URL's X-Amz-Date / X-Amz-Expires.

        Falls back to a conservative default TTL if the token can't be parsed so a
        malformed token still triggers periodic refresh rather than never expiring.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        expires_at = now + RDS_IAM_TOKEN_DEFAULT_TTL
        try:
            query_params = parse_qs(urlparse(token).query)
            amz_date = query_params["X-Amz-Date"][0]
            amz_expires = int(query_params["X-Amz-Expires"][0])
            issued_at = datetime.datetime.strptime(amz_date, "%Y%m%dT%H%M%SZ").replace(tzinfo=datetime.timezone.utc)
            expires_at = issued_at + datetime.timedelta(seconds=amz_expires)
        except (KeyError, ValueError, IndexError) as exc:
            logger.warning(f"Could not parse RDS IAM token expiry, using default TTL: {exc}")
        return expires_at
