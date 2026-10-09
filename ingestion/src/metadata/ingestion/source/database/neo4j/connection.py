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
Source connection handler for Neo4j.

Neo4j speaks Bolt, not SQL: a check's reported ``command`` is the Cypher it ran,
and failures arrive as neo4j driver exceptions carrying a ``Neo.*`` status code.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from metadata.core.connections.test_connection import (
    ErrorPack,
    Matchers,
    StepName,
    check,
    exception_chain,
    when,
)
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.checks.summary import enumerated, more_suffix
from metadata.core.connections.test_connection.network import NETWORK_ERRORS, probe_or_fail
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.database.neo4jConnection import (
    Neo4jConnection as Neo4jConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.neo4jConnection import (
    Neo4jScheme,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.neo4j.queries import (
    NEO4J_HOME_DATABASE,
    NEO4J_TEST_NODE_LABELS,
    NEO4J_TEST_RELATIONSHIP_TYPES,
)
from neo4j import GraphDatabase, RoutingControl
from neo4j.exceptions import ConfigurationError, ServiceUnavailable

if TYPE_CHECKING:
    from typing_extensions import LiteralString

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider, Matcher
    from neo4j import Driver

DEFAULT_BOLT_PORT = 7687

# A check only needs to prove the schema can be listed, not enumerate all of it.
DEFAULT_LIST_LIMIT = 100


class Neo4jStep(StepName):
    """Graph-specific steps, alongside the shared CheckAccess and GetDatabases."""

    GetNodeLabels = "GetNodeLabels"
    GetRelationshipTypes = "GetRelationshipTypes"


def _status_code(*codes: str) -> Matcher:
    """Match a Neo4j status code (``Neo.ClientError...``) anywhere in the cause chain."""
    wanted = frozenset(codes)
    return lambda error: any(getattr(current, "code", None) in wanted for current in exception_chain(error))


NEO4J_ERRORS = ErrorPack(
    when(_status_code("Neo.ClientError.Security.Unauthorized")).diagnose(
        "Authentication failed",
        fix="Check the username and password, and that the user is not suspended.",
    ),
    when(_status_code("Neo.ClientError.Database.DatabaseNotFound")).diagnose(
        "Database not found",
        fix="Verify databaseName exists on the server, or leave it blank to use the user's home database.",
    ),
    when(_status_code("Neo.ClientError.Security.Forbidden")).diagnose(
        "Insufficient privileges",
        fix="Grant the user ACCESS on the database and EXECUTE on the db.schema.*, db.labels "
        "and db.relationshipTypes procedures.",
    ),
    when(Matchers.contains("certificate verify failed")).diagnose(
        "TLS certificate not trusted",
        fix="Use the neo4j+ssc or bolt+ssc scheme for a self-signed certificate, or install the "
        "issuing CA on the host running ingestion.",
    ),
    when(Matchers.exception(ServiceUnavailable)).diagnose(
        "Neo4j is unavailable",
        fix="The server did not accept a Bolt connection. Check the scheme (Neo4j Aura needs neo4j+s), "
        "hostPort, and that the server is running.",
    ),
    when(Matchers.exception(ConfigurationError)).diagnose(
        "Invalid connection configuration",
        fix="Check the connection scheme and hostPort.",
    ),
).including(NETWORK_ERRORS)


def host_and_port(host_port: str) -> tuple[str, int]:
    """Split ``host[:port]``; Bolt defaults to 7687 when the port is omitted."""
    host, separator, port = host_port.rpartition(":")
    if not separator or not port.isdigit():
        return host_port, DEFAULT_BOLT_PORT
    return host, int(port)


def resolve_database(driver: Driver, connection: Neo4jConnectionConfig) -> str:
    """The configured database, else the user's home database."""
    if connection.databaseName:
        return connection.databaseName
    records, _, _ = driver.execute_query(NEO4J_HOME_DATABASE, routing_=RoutingControl.READ)
    return records[0]["name"]


def run_read(
    driver: Driver, query: LiteralString, database: str | None, parameters: dict[str, Any] | None = None
) -> list:
    records, _, _ = driver.execute_query(query, parameters, database_=database, routing_=RoutingControl.READ)
    return records


class Neo4jChecks:
    """Test-connection checks for Neo4j."""

    errors = NEO4J_ERRORS

    def __init__(self, driver: Borrowed[Driver], connection: Neo4jConnectionConfig) -> None:
        self._driver = driver
        self._connection = connection
        self._database: str | None = connection.databaseName

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        probe_or_fail(*host_and_port(self._connection.hostPort))
        command = "verify_connectivity"
        try:
            self._driver.client.verify_connectivity()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(summary="connection established", command=command)

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        command = "RETURN 1" if self._connection.databaseName else NEO4J_HOME_DATABASE
        try:
            self._database = resolve_database(self._driver.client, self._connection)
            run_read(self._driver.client, "RETURN 1", self._database)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        scope = "configured" if self._connection.databaseName else "home"
        return Evidence(summary=f"{scope} database '{self._database}' accessible", command=command)

    @check(Neo4jStep.GetNodeLabels)
    def get_node_labels(self) -> Evidence:
        return self._list(NEO4J_TEST_NODE_LABELS, "node label")

    @check(Neo4jStep.GetRelationshipTypes)
    def get_relationship_types(self) -> Evidence:
        return self._list(NEO4J_TEST_RELATIONSHIP_TYPES, "relationship type")

    def _list(self, query: LiteralString, noun: str) -> Evidence:
        try:
            records = run_read(self._driver.client, query, self._database, {"limit": DEFAULT_LIST_LIMIT + 1})
        except Exception as cause:
            raise CheckError(cause, Evidence(command=query)) from cause
        shown = min(len(records), DEFAULT_LIST_LIMIT)
        caveat = None
        if not records:
            caveat = Diagnosis(
                title=f"No {noun}s visible",
                remediation=f"The database may be empty, or the user may lack read access to its {noun}s; "
                "ingestion would collect nothing from them as configured.",
            )
        summary = enumerated(shown, noun) + more_suffix(shown, len(records) > DEFAULT_LIST_LIMIT)
        return Evidence(summary=summary, command=query, caveat=caveat)


class Neo4jConnection(BaseConnection[Neo4jConnectionConfig, "Driver"]):
    def _get_client(self) -> Driver:
        connection = self.service_connection
        scheme = connection.scheme or Neo4jScheme.neo4j
        driver = GraphDatabase.driver(
            f"{scheme.value}://{connection.hostPort}",
            auth=(connection.username, connection.password.get_secret_value()),
        )
        self._on_close(driver.close)
        return driver

    def checks(self) -> ChecksProvider:
        return Neo4jChecks(driver=self.borrow(), connection=self.service_connection)
