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
Source connection handler for S3 object store. For this to work, it requires the following S3 permissions for all
the buckets which require ingestion: s3:ListBucket, s3:GetObject and s3:GetBucketLocation
The cloudwatch client is used to fetch the total size in bytes for a bucket, and the total nr of files. This requires
the cloudwatch:GetMetricData permissions
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from botocore.exceptions import EndpointConnectionError, NoCredentialsError

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import ErrorPack, Matchers, check, when
from metadata.core.connections.test_connection.checks.storage import (
    StorageStep,
    list_buckets,
    list_metrics,
    probe_buckets,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.storage.s3Connection import (
    S3Connection as S3ConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection

if TYPE_CHECKING:
    from collections.abc import Callable

    from botocore.client import BaseClient

    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.records import Evidence


# botocore raises every AWS-side rejection as a ClientError whose message embeds
# the service error code ("An error occurred (InvalidAccessKeyId) when calling
# ..."), so the pack matches on those stable codes. Client-side failures
# (missing credentials, unreachable endpoint) surface as dedicated botocore
# exception types and are matched by type.
S3_ERRORS = ErrorPack(
    when(Matchers.contains("InvalidAccessKeyId")).diagnose(
        "Invalid AWS access key",
        fix="The awsAccessKeyId does not exist in AWS; check the configured credentials.",
    ),
    when(Matchers.contains("SignatureDoesNotMatch")).diagnose(
        "AWS secret key does not match",
        fix="The awsSecretAccessKey is wrong for this awsAccessKeyId; re-enter the credential pair.",
    ),
    when(Matchers.contains("UnrecognizedClientException")).diagnose(
        "AWS credentials not recognized",
        fix="The security token or access key is invalid; check the configured credentials.",
    ),
    when(Matchers.contains("InvalidClientTokenId")).diagnose(
        "AWS security token is invalid",
        fix="The awsSessionToken (or access key) is invalid for this region; refresh the credentials.",
    ),
    when(Matchers.contains("ExpiredToken")).diagnose(
        "AWS session token expired",
        fix="Temporary credentials have expired; refresh the awsSessionToken.",
    ),
    when(Matchers.contains("NoSuchBucket")).diagnose(
        "Bucket not found",
        fix="Verify the configured bucketNames exist in this AWS account and region.",
    ),
    when(Matchers.contains("AccessDenied")).diagnose(
        "Not authorized",
        fix="Grant s3:ListAllMyBuckets (or s3:ListBucket on the configured buckets) "
        "and cloudwatch:ListMetrics to the identity used.",
    ),
    when(Matchers.exception(NoCredentialsError)).diagnose(
        "No AWS credentials found",
        fix="No credentials were configured or resolvable; set awsAccessKeyId/awsSecretAccessKey "
        "or make an IAM role available where ingestion runs.",
    ),
    when(Matchers.exception(EndpointConnectionError)).diagnose(
        "Cannot reach the AWS endpoint",
        fix="Check awsRegion (and endPointURL for S3-compatible services), and that the "
        "network allows access to it from where ingestion runs.",
    ),
).including(NETWORK_ERRORS)


@dataclass
class S3ObjectStoreClient:
    s3_client: BaseClient
    cloudwatch_client: BaseClient
    session: Any = None


def get_connection(connection: S3ConnectionConfig) -> S3ObjectStoreClient:
    """
    Returns 2 clients - the s3 client and the cloudwatch client needed for total nr of objects and total size
    """
    aws_client = AWSClient(connection.awsConfig)
    session = aws_client.create_session()
    endpoint_url = str(connection.awsConfig.endPointURL) if connection.awsConfig.endPointURL else None
    kwargs = {"endpoint_url": endpoint_url} if endpoint_url else {}
    return S3ObjectStoreClient(
        s3_client=session.client(service_name="s3", **kwargs),
        cloudwatch_client=session.client(service_name="cloudwatch", **kwargs),
        session=session,
    )


class S3Checks:
    """Test-connection checks for S3.

    The client is built lazily inside the checks: an assume-role configuration
    calls STS while the boto3 session is created, so building it while the
    provider is constructed would touch the network before the runner's gate
    (and outside its per-step timeout). ``connect`` is ``BaseConnection.client``
    underneath, so both steps share the one cached client.
    """

    errors = S3_ERRORS

    def __init__(self, connect: Callable[[], S3ObjectStoreClient], bucket_names: list[str] | None) -> None:
        self._connect = connect
        self.bucket_names = bucket_names

    @check(StorageStep.ListBuckets)
    def check_buckets(self) -> Evidence:
        client = self._connect()
        if self.bucket_names:
            return probe_buckets(client.s3_client, self.bucket_names)
        return list_buckets(client.s3_client)

    @check(StorageStep.GetMetrics)
    def get_metrics(self) -> Evidence:
        return list_metrics(self._connect().cloudwatch_client, "AWS/S3")


class S3Connection(BaseConnection[S3ConnectionConfig, S3ObjectStoreClient]):
    def _get_client(self) -> S3ObjectStoreClient:
        return get_connection(self.service_connection)

    def checks(self) -> ChecksProvider:
        return S3Checks(
            connect=lambda: self.client,
            bucket_names=self.service_connection.bucketNames,
        )
