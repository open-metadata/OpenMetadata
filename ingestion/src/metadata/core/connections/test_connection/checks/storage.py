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

The helper *bodies* read boto3 response shapes (``response['Buckets']``,
``ContinuationToken``, ...) and label their ``command`` with the AWS service
prefix, so they suit S3 and other boto3-backed AWS object stores. A future
non-boto3 connector (e.g. GCS via ``google-cloud-storage``) has a different
client and response shape and should add its own helpers here rather than
force-fit these; only ``StorageStep`` is truly client-agnostic.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from metadata.core.connections.test_connection.check import CheckError, StepName
from metadata.core.connections.test_connection.records import Diagnosis, Evidence

if TYPE_CHECKING:
    from collections.abc import Sequence

    from botocore.client import BaseClient


# A check only needs to prove a listing is reachable, not enumerate the whole
# account, so every listing probe stops at this many assets and reports whether
# more exist beyond the cap.
DEFAULT_LIST_LIMIT = 100


class StorageStep(StepName):
    """The steps a storage connector can be asked to verify."""

    ListBuckets = "ListBuckets"
    GetMetrics = "GetMetrics"


def _count(n: int, noun: str) -> str:
    """``3 buckets`` / ``1 bucket`` - pluralize the noun to match the count."""
    return f"{n} {noun if n == 1 else noun + 's'}"


def _more_suffix(shown: int, more: bool) -> str:
    """Mark a summary as capped when the listing has more assets beyond ``shown``."""
    return f" (showing first {shown}; more exist)" if more else ""


def list_buckets(client: BaseClient, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the buckets the identity can see, reporting at most ``limit``.

    The cap is applied to the reported count locally, not pushed to the API: the
    request stays a parameter-less ``list_buckets()`` so it behaves identically
    on AWS and on S3-compatible stores (MinIO, Ceph, ...) reached via an
    ``endPointURL`` that may not understand AWS's newer ``MaxBuckets`` parameter.
    A bucket list is inherently small (account-bounded), so this never pulls an
    unbounded payload; the summary flags when more than ``limit`` exist.

    An empty listing never raises - the account may simply hold no buckets -
    so 'none visible' surfaces as a non-blocking caveat for the user to judge.
    A missing list permission is a different case: it raises ``AccessDenied``,
    which fails the step rather than producing a caveat.
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
    summary = f"{_count(shown, 'bucket')} enumerated" + _more_suffix(shown, len(buckets) > limit)
    return Evidence(summary=summary, command=command, caveat=caveat)


def probe_buckets(client: BaseClient, buckets: Sequence[str]) -> Evidence:
    """Prove each configured bucket exists and its objects can be listed.

    This is an access probe over an explicit, config-bounded set - not an open
    enumeration - so it caps each bucket's listing at a single key: proving
    access never needs the contents, and a large bucket must not turn a
    connection test into an expensive full listing.
    """
    for bucket in buckets:
        try:
            client.list_objects(Bucket=bucket, MaxKeys=1)  # pyright: ignore[reportAttributeAccessIssue]
        except Exception as cause:
            raise CheckError(cause, Evidence(command=f"s3:ListBucket ({bucket})")) from cause
    return Evidence(
        summary=f"{_count(len(buckets), 'configured bucket')} accessible",
        command="s3:ListBucket",
    )


def list_metrics(client: BaseClient, namespace: str, limit: int = DEFAULT_LIST_LIMIT) -> Evidence:
    """Enumerate the CloudWatch metrics for ``namespace``, up to ``limit``.

    ``list_metrics`` has no page-size parameter (AWS returns up to 500 per page),
    so the count is capped to ``limit`` here; a ``NextToken`` (or a page already
    past the cap) means more exist and the summary says so.

    Metrics feed object-count and size extraction; without them ingestion still
    works, so an empty listing only reports what was (not) found.
    """
    command = f"cloudwatch:ListMetrics (Namespace={namespace})"
    try:
        response = client.list_metrics(Namespace=namespace)  # pyright: ignore[reportAttributeAccessIssue]
    except Exception as cause:
        raise CheckError(cause, Evidence(command=command)) from cause
    metrics = response.get("Metrics", [])
    more = bool(response.get("NextToken")) or len(metrics) > limit
    shown = min(len(metrics), limit)
    summary = f"{_count(shown, 'metric')} visible in namespace '{namespace}'" + _more_suffix(shown, more)
    return Evidence(summary=summary, command=command)
