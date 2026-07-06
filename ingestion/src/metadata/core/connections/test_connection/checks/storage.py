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
Storage service step identity and shared check helpers.

Object stores have no SQL: the reported ``command`` is the API operation the
check exercised (e.g. ``s3:ListBuckets``). Connectors reuse these helpers from
their ``@check`` methods. On failure the helpers raise ``CheckError`` carrying
the operation they attempted, so a failed step still reports its ``Evidence``
to the backend.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Sequence

    from botocore.client import BaseClient


class StorageStep(StepName):
    """The steps a storage connector can be asked to verify."""

    ListBuckets = "ListBuckets"
    GetMetrics = "GetMetrics"


def _count(n: int, noun: str) -> str:
    """``3 buckets`` / ``1 bucket`` - pluralize the noun to match the count."""
    return f"{n} {noun if n == 1 else noun + 's'}"


def list_buckets(client: BaseClient) -> Evidence:
    """Enumerate every bucket the identity can see.

    An empty listing never raises - the account may simply hold no buckets, or
    the identity may lack ``s3:ListAllMyBuckets``-style permissions on them -
    so 'none visible' surfaces as a non-blocking caveat for the user to judge.
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
    return Evidence(
        summary=f"{_count(len(buckets), 'bucket')} enumerated",
        command=command,
        caveat=caveat,
    )


def probe_buckets(client: BaseClient, buckets: Sequence[str]) -> Evidence:
    """Prove each configured bucket exists and its objects can be listed."""
    for bucket in buckets:
        try:
            client.list_objects(Bucket=bucket)  # pyright: ignore[reportAttributeAccessIssue]
        except Exception as cause:
            raise CheckError(cause, Evidence(command=f"s3:ListBucket ({bucket})")) from cause
    return Evidence(
        summary=f"{_count(len(buckets), 'configured bucket')} accessible",
        command="s3:ListBucket",
    )


def list_metrics(client: BaseClient, namespace: str) -> Evidence:
    """Enumerate the CloudWatch metrics for ``namespace``.

    Metrics feed object-count and size extraction; without them ingestion still
    works, so an empty listing only reports what was (not) found.
    """
    command = f"cloudwatch:ListMetrics (Namespace={namespace})"
    try:
        response = client.list_metrics(Namespace=namespace)  # pyright: ignore[reportAttributeAccessIssue]
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    metrics = response.get("Metrics", [])
    return Evidence(
        summary=f"{_count(len(metrics), 'metric')} visible in namespace '{namespace}'",
        command=command,
    )
