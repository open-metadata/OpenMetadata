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
Source connection handler for S3 object store. For this to work, it requires the following S3 permissions for all
the buckets which require ingestion: s3:ListBucket, s3:GetObject and s3:GetBucketLocation
The cloudwatch client is used to fetch the total size in bytes for a bucket, and the total nr of files. This requires
the cloudwatch:GetMetricData permissions

"""
from dataclasses import dataclass
from functools import partial

from botocore.client import BaseClient

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.services.connections.objectstore.s3ObjectStoreConnection import (
    S3StoreConnection,
)
from metadata.ingestion.connections.test_connections import (
    TestConnectionResult,
    TestConnectionStep,
    test_connection_steps,
)


@dataclass
class S3ObjectStoreClient:
    s3_client: BaseClient
    cloudwatch_client: BaseClient


def get_connection(connection: S3StoreConnection) -> S3ObjectStoreClient:
    """
    Returns 2 clients - the s3 client and the cloudwatch client needed for total nr of objects and total size
    """
    aws_client = AWSClient(connection.awsConfig)
    return S3ObjectStoreClient(
        s3_client=aws_client.get_client(service_name="s3"),
        cloudwatch_client=aws_client.get_client(service_name="cloudwatch"),
    )


def test_connection(client: S3ObjectStoreClient) -> TestConnectionResult:
    """
    Test connection
    """
    steps = [
        TestConnectionStep(
            function=client.s3_client.list_buckets,
            name="List buckets",
        ),
        TestConnectionStep(
            function=partial(
                client.cloudwatch_client.list_metrics,
                Namespace="AWS/S3",
            ),
            name="Get Cloudwatch AWS/S3 metrics",
            mandatory=False,
        ),
    ]

    return test_connection_steps(steps)
