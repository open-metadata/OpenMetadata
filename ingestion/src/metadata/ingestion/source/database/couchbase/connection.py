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
Source connection handler
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from metadata.core.connections.test_connection import ErrorPack, Evidence, Matchers, check, when
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.checks.scope import ProbeScope, probe_targets
from metadata.core.connections.test_connection.checks.summary import count, enumerated
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.core.connections.test_connection.records import Diagnosis
from metadata.generated.schema.entity.services.connections.database.couchbaseConnection import (
    CouchbaseConnection as CouchbaseConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider


# The SDK is an optional dependency imported lazily in `_get_client`, so the
# rules match on message text rather than on exception types - importing
# couchbase.exceptions here would make this module unimportable without it.
COUCHBASE_ERRORS = ErrorPack(
    when(Matchers.contains("authentication")).diagnose(
        "Authentication failed",
        fix="Check the username and password of the Couchbase user.",
    ),
    when(Matchers.any_of(Matchers.contains("no access"), Matchers.contains("forbidden"))).diagnose(
        "Not authorized",
        fix="Grant the user a role that can read the buckets it should ingest "
        "(`data_reader` plus `views_reader` on those buckets), or set `bucket` to one it can read.",
    ),
    when(Matchers.contains("bucket_not_found")).diagnose(
        "Bucket not found",
        fix="The configured `bucket` does not exist on this cluster; check it for typos.",
    ),
    when(Matchers.contains("unambiguoustimeout")).diagnose(
        "Cluster did not respond in time",
        fix="Check that hostport points at the cluster and that the Couchbase ports are reachable "
        "from where ingestion runs; `couchbases://` is required for a TLS-only cluster.",
    ),
).including(NETWORK_ERRORS)


class CouchbaseChecks:
    """Test-connection checks for Couchbase.

    Buckets are ingested as OpenMetadata databases and scopes as its schemas, so
    the `bucket` field is what says which bucket a run would read. It is
    deliberately the only narrowing applied: `databaseFilterPattern` is not
    honoured by `CouchbaseSource.get_database_names`, so probing by it would fail
    connections whose ingestion reads those buckets anyway.
    """

    errors = COUCHBASE_ERRORS

    def __init__(self, cluster: Borrowed[Any], scope: ProbeScope) -> None:
        self._cluster = cluster
        self._scope = scope
        self._targeted: list[str] | None = None

    def _targeted_buckets(self) -> list[str]:
        """The buckets the configured scope would read.

        Memoized, and resolved lazily so no listing runs ahead of the gate step.
        A pinned bucket needs no listing, so the cluster is pinged instead - the
        gate has to dial the cluster either way, or an unreachable one would pass
        it and surface only in the next step.
        """
        if self._targeted is None:
            if self._scope.pinned:
                self._cluster.client.ping()
                self._targeted = self._scope.targets([])
            else:
                buckets = self._cluster.client.buckets().get_all_buckets()
                self._targeted = self._scope.targets(bucket.name for bucket in buckets)
        return self._targeted

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        command = "buckets.get_all_buckets()" if not self._scope.pinned else "ping()"
        try:
            targeted = self._targeted_buckets()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(
            summary=enumerated(len(targeted), "bucket"),
            command=command,
            caveat=None if targeted else _no_buckets(),
        )

    @check(DatabaseStep.GetCollections)
    def get_collections(self) -> Evidence:
        """Read the scopes of the targeted buckets, passing on the first that answers.

        A user granted data access on only the buckets it ingests is refused on the
        others, so one bucket refusing the read must not fail the step - only every
        targeted bucket refusing it does.
        """
        targeted = self._targeted_buckets()
        command = "bucket(<name>).collections().get_all_scopes()"
        if not targeted:
            return Evidence(summary="no bucket in scope to read scopes from", command=command, caveat=_no_buckets())

        found: dict[str, int] = {}

        def probe(bucket_name: str) -> None:
            collections = self._cluster.client.bucket(bucket_name).collections()
            found[bucket_name] = len(list(collections.get_all_scopes()))

        try:
            bucket_name = probe_targets(targeted, probe)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause

        number = found.get(bucket_name, 0) if bucket_name else 0
        return Evidence(
            summary=f"{count(number, 'scope')} in bucket '{bucket_name}'",
            command=command,
            caveat=None if number else _no_scopes(str(bucket_name)),
        )


def _no_buckets() -> Diagnosis:
    return Diagnosis(
        title="No bucket in scope",
        remediation="The cluster exposes no bucket to this user. Grant it access to the buckets it "
        "should ingest, or check the `bucket` setting. Ingestion would collect nothing as configured.",
    )


def _no_scopes(bucket_name: str) -> Diagnosis:
    return Diagnosis(
        title="No scopes visible",
        remediation=f"The read succeeded but bucket '{bucket_name}' exposes no scope. Confirm the "
        "bucket is not empty and that the user can see its collections.",
    )


class CouchbaseConnection(BaseConnection[CouchbaseConnectionConfig, Any]):
    def _get_client(self) -> Any:
        # pylint: disable=import-outside-toplevel
        from couchbase.auth import PasswordAuthenticator
        from couchbase.cluster import Cluster
        from couchbase.options import ClusterOptions

        connection = self.service_connection
        auth = PasswordAuthenticator(connection.username, connection.password.get_secret_value())
        url = f"{connection.scheme.value}://{connection.hostport}"  # pyright: ignore[reportOptionalMemberAccess]
        cluster = Cluster.connect(url, ClusterOptions(auth))  # pyright: ignore[reportArgumentType]
        self._on_close(cluster.close)
        return cluster

    def checks(self) -> ChecksProvider:
        # Borrowed, not built: reading the client is what dials the cluster, so a
        # connection failure lands inside the gate step.
        return CouchbaseChecks(
            cluster=self.borrow(),
            scope=ProbeScope(pinned=self.service_connection.bucket),
        )
