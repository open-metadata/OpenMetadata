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

from typing import TYPE_CHECKING

from cassandra import AuthenticationFailed, InvalidRequest, Unauthorized
from cassandra.auth import PlainTextAuthProvider
from cassandra.cluster import (
    EXEC_PROFILE_DEFAULT,
    Cluster,
    ExecutionProfile,
    NoHostAvailable,
    ProtocolVersion,
)
from cassandra.cluster import Session as CassandraSession
from metadata.core.connections.test_connection import ErrorPack, Evidence, Matchers, check, when
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.checks.scope import ProbeScope, probe_targets
from metadata.core.connections.test_connection.checks.summary import count, enumerated
from metadata.core.connections.test_connection.network import NETWORK_ERRORS, probe_or_fail
from metadata.core.connections.test_connection.records import Diagnosis
from metadata.generated.schema.entity.services.connections.database.cassandraConnection import (
    CassandraConnection as CassandraConnectionConfig,
)
from metadata.ingestion.connections.builders import init_empty_connection_arguments
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.cassandra.queries import (
    CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS,
    CASSANDRA_GET_KEYSPACE_TABLES,
    CASSANDRA_GET_KEYSPACES,
    CASSANDRA_GET_RELEASE_VERSION,
)

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider


# Ingestion reads the system keyspaces too, so they are probed rather than skipped -
# but only after the user keyspaces, so a healthy cluster reports on real data.
SYSTEM_KEYSPACES = frozenset(
    {
        "system",
        "system_auth",
        "system_distributed",
        "system_schema",
        "system_traces",
        "system_views",
        "system_virtual_schema",
    }
)


CASSANDRA_ERRORS = ErrorPack(
    when(Matchers.exception(AuthenticationFailed)).diagnose(
        "Authentication failed",
        fix="Check the username and password. On Astra, the client token must still be valid.",
    ),
    when(Matchers.exception(Unauthorized)).diagnose(
        "Not authorized",
        fix="Grant the role DESCRIBE on the keyspaces it should read "
        "(`GRANT DESCRIBE ON KEYSPACE <keyspace> TO <role>`), or narrow "
        "schemaFilterPattern to the keyspaces it can read.",
    ),
    when(Matchers.exception(NoHostAvailable)).diagnose(
        "No contact point answered",
        fix="Check hostPort, that the node is running, and that the native transport port "
        "(9042 by default) is reachable from where ingestion runs.",
    ),
    when(Matchers.exception(InvalidRequest)).diagnose(
        "Query rejected by the cluster",
        fix="The keyspace may have been dropped while the connection was being tested; re-run the test.",
    ),
).including(NETWORK_ERRORS)


class CassandraChecks:
    """Test-connection checks for Cassandra.

    Keyspaces are ingested as OpenMetadata schemas, so `schemaFilterPattern` is
    what says which of them the run would read - and therefore which of them are
    worth probing.
    """

    errors = CASSANDRA_ERRORS

    def __init__(
        self, session: Borrowed[CassandraSession], scope: ProbeScope, probe_target: tuple[str, int] | None
    ) -> None:
        self._session = session
        self._scope = scope
        self._probe_target = probe_target
        self._targeted: list[str] | None = None

    def _targeted_keyspaces(self) -> list[str]:
        """The keyspaces the configured scope would read, user keyspaces first.

        Memoized so the table and view checks share one listing, and resolved
        lazily - never at construction - so nothing runs ahead of the gate.
        """
        if self._targeted is None:
            rows = self._session.client.execute(CASSANDRA_GET_KEYSPACES)
            self._targeted = self._scope.targets(row.keyspace_name for row in rows)
        return self._targeted

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        # Astra connects through a secure bundle rather than a host:port, so the
        # TCP preflight only applies to a plain hostPort.
        if self._probe_target:
            probe_or_fail(*self._probe_target)
        rows = self._session.client.execute(CASSANDRA_GET_RELEASE_VERSION).current_rows
        version = rows[0].release_version if rows else "unknown"
        return Evidence(summary=f"connected to Cassandra {version}", command=_command(CASSANDRA_GET_RELEASE_VERSION))

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        targeted = self._targeted_keyspaces()
        return Evidence(
            summary=enumerated(len(targeted), "keyspace"),
            command=_command(CASSANDRA_GET_KEYSPACES),
            caveat=None if targeted else _nothing_in_scope(),
        )

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return self._probe_keyspaces("table", CASSANDRA_GET_KEYSPACE_TABLES)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return self._probe_keyspaces("materialized view", CASSANDRA_GET_KEYSPACE_MATERIALIZED_VIEWS)

    def _probe_keyspaces(self, kind: str, statement: str) -> Evidence:
        """Read `kind` from the targeted keyspaces, passing on the first that answers.

        A role restricted to the keyspaces it ingests can be unauthorized on every
        other one, so a single keyspace refusing the read must not fail the step -
        only every targeted keyspace refusing it does.
        """
        targeted = self._targeted_keyspaces()
        command = _command(statement)
        if not targeted:
            return Evidence(
                summary=f"no keyspace in scope to read {kind}s from", command=command, caveat=_nothing_in_scope()
            )

        found: dict[str, int] = {}

        def probe(keyspace: str) -> None:
            # current_rows is the first page: proving the read works never needs more.
            found[keyspace] = len(self._session.client.execute(statement, [keyspace]).current_rows)

        try:
            keyspace = probe_targets(targeted, probe)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause

        number = found.get(keyspace, 0) if keyspace else 0
        return Evidence(
            summary=f"{count(number, kind)} in keyspace '{keyspace}'",
            command=command,
            caveat=None if number or kind != "table" else _nothing_visible(kind, str(keyspace)),
        )


def _command(statement: str) -> str:
    return " ".join(statement.split())


def _nothing_in_scope() -> Diagnosis:
    return Diagnosis(
        title="No keyspace in scope",
        remediation="No keyspace survived schemaFilterPattern, or none is visible to this role. "
        "Ingestion would collect nothing as configured.",
    )


def _nothing_visible(kind: str, keyspace: str) -> Diagnosis:
    return Diagnosis(
        title=f"No {kind}s visible",
        remediation=f"The read succeeded but keyspace '{keyspace}' exposes no {kind}s. Confirm it is "
        f"not empty, and that the role holds DESCRIBE on the keyspaces it should read.",
    )


class CassandraConnection(BaseConnection[CassandraConnectionConfig, CassandraSession]):
    def _get_client(self) -> CassandraSession:
        connection = self.service_connection

        cluster_config = {}
        if hasattr(connection.authType, "cloudConfig"):
            cloud_config = connection.authType.cloudConfig  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
            cluster_cloud_config = {
                "connect_timeout": cloud_config.connectTimeout,  # pyright: ignore[reportOptionalMemberAccess]
                "use_default_tempdir": True,
                "secure_connect_bundle": cloud_config.secureConnectBundle,  # pyright: ignore[reportOptionalMemberAccess]
            }
            profile = ExecutionProfile(request_timeout=cloud_config.requestTimeout)  # pyright: ignore[reportOptionalMemberAccess, reportArgumentType]
            auth_provider = PlainTextAuthProvider("token", cloud_config.token)  # pyright: ignore[reportOptionalMemberAccess]
            cluster_config.update(
                {
                    "cloud": cluster_cloud_config,
                    "auth_provider": auth_provider,
                    "execution_profiles": {EXEC_PROFILE_DEFAULT: profile},
                    "protocol_version": ProtocolVersion.V4,
                }
            )
        else:
            host, port = connection.hostPort.split(":")
            cluster_config.update({"contact_points": [host], "port": port})
            if connection.username and getattr(connection.authType, "password", None):
                cluster_config["auth_provider"] = PlainTextAuthProvider(
                    username=connection.username,
                    password=connection.authType.password.get_secret_value(),  # pyright: ignore[reportOptionalMemberAccess, reportAttributeAccessIssue]
                )

        connection.connectionArguments = connection.connectionArguments or init_empty_connection_arguments()

        cluster = Cluster(
            **cluster_config,
            ssl_context=connection.connectionArguments.root.get("ssl_context"),  # pyright: ignore[reportOptionalMemberAccess]
        )
        self._on_close(cluster.shutdown)
        return cluster.connect()

    def checks(self) -> ChecksProvider:
        # Borrowed, not built: reading the client is what opens the cluster
        # session, so a connect failure lands inside the gate step.
        connection = self.service_connection
        return CassandraChecks(
            session=self.borrow(),
            scope=ProbeScope(excluded=connection.schemaFilterPattern, last_resort=SYSTEM_KEYSPACES),
            probe_target=_host_and_port(connection),
        )


def _host_and_port(connection: CassandraConnectionConfig) -> tuple[str, int] | None:
    """The host:port to TCP-preflight, or None when there is nothing to dial.

    Astra connects through a secure connect bundle, and a malformed hostPort is
    for the driver to report, not the preflight.
    """
    if hasattr(connection.authType, "cloudConfig") or not connection.hostPort:
        return None
    host, _, port = connection.hostPort.rpartition(":")
    if not host or not port.isdigit():
        return None
    return host, int(port)
