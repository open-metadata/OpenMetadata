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
Source connection handler for Amazon Neptune (openCypher property graphs).

Requests go through the boto3 ``neptunedata`` client, signed with SigV4 from the
standard AWS credential chain. Test-connection checks are read-only: they never
start a schema computation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import ErrorPack, Matchers, StepName, check, when
from metadata.core.connections.test_connection.aws import AWS_ERRORS, aws_code
from metadata.core.connections.test_connection.check import CheckError
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.checks.summary import enumerated
from metadata.core.connections.test_connection.network import probe_or_fail
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.database.neptuneConnection import (
    NeptuneConnection as NeptuneConnectionConfig,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.neptune.queries import NEPTUNE_PG_SCHEMA
from metadata.ingestion.source.database.neptune.schema import (
    NeptuneSchemaError,
    SchemaState,
    parse_schema,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider

DEFAULT_NEPTUNE_PORT = 8182

NEPTUNEDATA_SERVICE = "neptunedata"


class NeptuneStep(StepName):
    GetPropertyGraphSchema = "GetPropertyGraphSchema"
    GetNodeLabels = "GetNodeLabels"
    GetRelationshipTypes = "GetRelationshipTypes"


NEPTUNE_ERRORS = ErrorPack(
    when(aws_code("AccessDeniedException", "AccessDenied")).diagnose(
        "Not authorized",
        fix="Grant neptune-db:ReadDataViaQuery to the identity used. Computing the schema "
        "(computeSchemaIfMissing) also needs neptune-db:WriteDataViaQuery.",
    ),
    when(Matchers.exception(NeptuneSchemaError)).diagnose(
        "Property graph schema unavailable",
        fix="Neptune could not provide a property graph schema; see the error message for the cause.",
    ),
    when(Matchers.contains("read replica")).diagnose(
        "Schema cannot be computed on a read replica",
        fix="Point hostPort at the cluster (writer) endpoint, or run compute() on the writer and disable "
        "computeSchemaIfMissing.",
    ),
    when(Matchers.contains("pg_schema")).diagnose(
        "Schema procedure not supported",
        fix="neptune.graph.pg_schema() needs Neptune engine 1.4.8.0 or later and the openCypher endpoint.",
    ),
).including(AWS_ERRORS)


def host_and_port(host_port: str) -> tuple[str, int]:
    """Split ``host[:port]``; Neptune defaults to 8182 when the port is omitted."""
    host, separator, port = host_port.rpartition(":")
    if not separator or not port.isdigit():
        return host_port, DEFAULT_NEPTUNE_PORT
    return host, int(port)


def endpoint_url(host_port: str) -> str:
    host, port = host_and_port(host_port)
    return f"https://{host}:{port}"


def run_query(client: Any, query: str) -> list[Mapping[str, Any]]:
    """Run an openCypher statement and return its rows."""
    return client.execute_open_cypher_query(openCypherQuery=query).get("results", [])


class NeptuneChecks:
    """Test-connection checks for Neptune."""

    errors = NEPTUNE_ERRORS

    def __init__(self, client: Borrowed[Any], connection: NeptuneConnectionConfig) -> None:
        self._client = client
        self._connection = connection
        self._payload: Mapping[str, Any] | None = None
        self._state: SchemaState | None = None

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        probe_or_fail(*host_and_port(self._connection.hostPort))
        command = "RETURN 1"
        try:
            run_query(self._client.client, command)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(summary="connection established", command=command)

    @check(NeptuneStep.GetPropertyGraphSchema)
    def get_property_graph_schema(self) -> Evidence:
        from metadata.ingestion.source.database.neptune.schema import (
            SchemaReader,
        )

        reader = SchemaReader(
            lambda query: run_query(self._client.client, query),
            compute_if_missing=False,
            timeout_seconds=1,
        )
        try:
            state, self._payload = reader.read_state()
        except Exception as cause:
            raise CheckError(cause, Evidence(command=NEPTUNE_PG_SCHEMA)) from cause
        self._state = state
        if state is SchemaState.READY:
            return Evidence(summary="property graph schema available", command=NEPTUNE_PG_SCHEMA)
        if state is SchemaState.IN_PROGRESS:
            return Evidence(
                summary="property graph schema computation in progress",
                command=NEPTUNE_PG_SCHEMA,
                caveat=Diagnosis(
                    title="Schema still computing",
                    remediation="Ingestion waits for the computation up to schemaComputeTimeoutSeconds.",
                ),
            )
        interrupted = state is SchemaState.INTERRUPTED
        needs = "will be computed" if self._connection.computeSchemaIfMissing else "must be computed manually"
        return Evidence(
            summary="property graph schema computation interrupted"
            if interrupted
            else "no property graph schema computed yet",
            command=NEPTUNE_PG_SCHEMA,
            caveat=Diagnosis(
                title="Schema incomplete" if interrupted else "Schema not computed",
                remediation=f"Ingestion {needs}: with computeSchemaIfMissing the identity also needs "
                "neptune-db:WriteDataViaQuery and must target the writer instance; otherwise run "
                "CALL neptune.graph.pg_schema.compute().",
            ),
        )

    @check(NeptuneStep.GetNodeLabels)
    def get_node_labels(self) -> Evidence:
        return self._labels("nodes", "node label")

    @check(NeptuneStep.GetRelationshipTypes)
    def get_relationship_types(self) -> Evidence:
        return self._labels("edges", "edge label")

    def _labels(self, kind: str, noun: str) -> Evidence:
        if self._state is not SchemaState.READY or self._payload is None:
            return Evidence(
                summary=f"no {noun}s read",
                command=NEPTUNE_PG_SCHEMA,
                caveat=Diagnosis(
                    title="Schema not available",
                    remediation="The property graph schema has not been computed yet, so no labels can be listed.",
                ),
            )
        try:
            names = getattr(parse_schema(self._payload), kind)
        except Exception as cause:
            raise CheckError(cause, Evidence(command=NEPTUNE_PG_SCHEMA)) from cause
        return Evidence(summary=enumerated(len(names), noun), command=NEPTUNE_PG_SCHEMA)


class NeptuneConnection(BaseConnection[NeptuneConnectionConfig, Any]):
    def _get_client(self) -> Any:
        connection = self.service_connection
        session = AWSClient(connection.awsConfig).create_session()
        return session.client(NEPTUNEDATA_SERVICE, endpoint_url=endpoint_url(connection.hostPort))

    def checks(self) -> ChecksProvider:
        return NeptuneChecks(client=self.borrow(), connection=self.service_connection)
