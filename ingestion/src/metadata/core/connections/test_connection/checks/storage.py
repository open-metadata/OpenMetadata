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
Storage service step identity and check helpers.

The reported ``command`` is the API operation exercised (``s3:ListBuckets``).
The helper bodies read boto3 response shapes; only ``StorageStep`` is
client-agnostic, so a non-boto3 store should add its own helpers here.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.checks.summary import count, enumerated, more_suffix
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Sequence

    from botocore.client import BaseClient


# Cap on the assets a listing probe reports; it flags when more exist.
DEFAULT_LIST_LIMIT = 100


class StorageStep(StepName):
    """The steps a storage connector can be asked to verify."""

    ListBuckets = "ListBuckets"
    GetMetrics = "GetMetrics"


def list_buckets(client: BaseClient, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the buckets the identity can see, reporting at most ``limit``.

    Empty is a caveat, not a failure - the account may hold no buckets; a missing
    permission raises ``AccessDenied`` instead. The cap is applied locally so the
    request stays parameter-less for S3-compatible stores that lack ``MaxBuckets``.
    """
    command = "s3:ListBuckets"
    try:
        response = client.list_buckets()  # pyright: ignore[reportAttributeAccessIssue]
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    buckets = response.get("Buckets", [])
    caveat = None
    if not buckets:
        caveat = Diagnosis(
            title="No buckets visible",
            remediation="Verify the identity can list buckets, or configure bucketNames explicitly.",
        )
    shown = min(len(buckets), limit)
    summary = enumerated(shown, "bucket") + more_suffix(shown, len(buckets) > limit)
    return Evidence(summary=summary, command=command, caveat=caveat)


def probe_buckets(client: BaseClient, buckets: Sequence[str]) -> Evidence:
    """Prove each configured bucket exists and its objects can be listed.

    Caps each listing at one key: proving access never needs the contents.
    """
    for bucket in buckets:
        try:
            client.list_objects(Bucket=bucket, MaxKeys=1)  # pyright: ignore[reportAttributeAccessIssue]
        except Exception as cause:
            raise CheckError(cause, Evidence(command=f"s3:ListBucket ({bucket})")) from cause
    return Evidence(
        summary=f"{count(len(buckets), 'configured bucket')} accessible",
        command="s3:ListBucket",
    )


def list_metrics(client: BaseClient, namespace: str, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the CloudWatch metrics for ``namespace``, up to ``limit``.

    ``list_metrics`` has no page-size parameter, so the cap is applied locally.
    Empty only reports what was found - metrics are optional for ingestion.
    """
    command = f"cloudwatch:ListMetrics (Namespace={namespace})"
    try:
        response = client.list_metrics(Namespace=namespace)  # pyright: ignore[reportAttributeAccessIssue]
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    metrics = response.get("Metrics", [])
    more = bool(response.get("NextToken")) or len(metrics) > limit
    shown = min(len(metrics), limit)
    summary = f"{count(shown, 'metric')} visible in namespace '{namespace}'" + more_suffix(shown, more)
    return Evidence(summary=summary, command=command)
