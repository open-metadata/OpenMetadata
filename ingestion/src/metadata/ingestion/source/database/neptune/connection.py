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
Source connection handler for Amazon Neptune property and RDF graphs.

Data API requests use boto3; SPARQL uses Neptune's HTTP endpoint. Both use the
standard AWS credential chain and SigV4 when credentials are available.
Test-connection checks are read-only: they never start a schema computation.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode

import requests
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

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
from metadata.ingestion.source.database.neptune.rdf import (
    NeptuneRDFSchemaError,
    NeptuneRDFStatisticsUnavailableError,
    parse_graph_summary,
)
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
SPARQL_TEST_QUERY = (
    "PREFIX hint: <http://aws.amazon.com/neptune/vocab/v01/QueryHints#> "
    "SELECT ?s WHERE { hint:Query hint:queryTimeout 1000 . ?s ?p ?o } LIMIT 1"
)


class NeptuneStep(StepName):
    GetPropertyGraphSchema = "GetPropertyGraphSchema"
    GetNodeLabels = "GetNodeLabels"
    GetRelationshipTypes = "GetRelationshipTypes"
    GetRDFGraphSummary = "GetRDFGraphSummary"


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

NEPTUNE_RDF_ERRORS = ErrorPack(
    when(aws_code("AccessDeniedException", "AccessDenied")).diagnose(
        "Not authorized",
        fix="Grant neptune-db:ReadDataViaQuery for SPARQL queries and neptune-db:GetGraphSummary "
        "for the RDF graph summary.",
    ),
    when(Matchers.exception(NeptuneRDFStatisticsUnavailableError)).diagnose(
        "RDF graph summary unavailable",
        fix="Neptune requires engine 1.2.1.0 or later and available DFE statistics. Statistics are "
        "disabled on db.t3.medium and db.t4g.medium; wait for automatic generation or use a supported instance.",
    ),
    when(Matchers.exception(NeptuneRDFSchemaError)).diagnose(
        "RDF graph summary unavailable",
        fix="Neptune could not provide a usable RDF graph summary; see the error message for the cause.",
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


def is_rdf(connection: NeptuneConnectionConfig) -> bool:
    """Whether the configured Neptune graph uses RDF/SPARQL."""
    return getattr(connection.graphModel, "value", connection.graphModel) == "rdf"


class NeptuneDataClient:
    """Neptune Data API and SigV4-authenticated SPARQL HTTP client."""

    def __init__(self, session: Any, host_port: str) -> None:
        self._session = session
        self._data_client = session.client(NEPTUNEDATA_SERVICE, endpoint_url=endpoint_url(host_port))
        self._sparql_url = f"{endpoint_url(host_port)}/sparql"
        self._http = requests.Session()

    def close(self) -> None:
        try:
            self._http.close()
        finally:
            self._data_client.close()

    def execute_open_cypher_query(self, openCypherQuery: str) -> dict:  # noqa: N803
        return self._data_client.execute_open_cypher_query(openCypherQuery=openCypherQuery)

    def get_rdf_graph_summary(self, mode: str = "basic") -> dict:
        return self._data_client.get_rdf_graph_summary(mode=mode)

    def execute_sparql_query(self, query: str, timeout_seconds: int) -> list[Mapping[str, Any]]:
        body = urlencode({"query": query})
        headers = {
            "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        request = AWSRequest(method="POST", url=self._sparql_url, data=body, headers=headers)
        credentials = self._session.get_credentials()
        if credentials:
            region = self._session.region_name
            if not region:
                raise ValueError("Set awsRegion to sign Neptune SPARQL requests with SigV4.")
            SigV4Auth(credentials.get_frozen_credentials(), "neptune-db", region).add_auth(request)

        response = self._http.post(
            self._sparql_url,
            data=body,
            headers=dict(request.headers.items()),
            timeout=(10, timeout_seconds + 5),
            allow_redirects=False,
        )
        if response.status_code < 200 or response.status_code >= 300:
            response.raise_for_status()
            raise RuntimeError(f"Neptune SPARQL endpoint returned HTTP {response.status_code}.")
        payload = response.json()
        results = payload.get("results") if isinstance(payload, dict) else None
        bindings = results.get("bindings") if isinstance(results, dict) else None
        if not isinstance(bindings, list):
            raise NeptuneRDFSchemaError("Neptune returned an invalid SPARQL SELECT response.")
        return bindings


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
        client = NeptuneDataClient(session, connection.hostPort)
        self._on_close(client.close)
        return client

    def checks(self) -> ChecksProvider:
        if is_rdf(self.service_connection):
            return NeptuneRDFChecks(client=self.borrow(), connection=self.service_connection)
        return NeptuneChecks(client=self.borrow(), connection=self.service_connection)


class NeptuneRDFChecks:
    """Read-only test-connection checks for an RDF Neptune graph."""

    errors = NEPTUNE_RDF_ERRORS

    def __init__(self, client: Borrowed[Any], connection: NeptuneConnectionConfig) -> None:
        self._client = client
        self._connection = connection

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        probe_or_fail(*host_and_port(self._connection.hostPort))
        try:
            self._client.client.execute_sparql_query(
                SPARQL_TEST_QUERY,
                timeout_seconds=1,
            )
        except Exception as cause:
            raise CheckError(cause, Evidence(command=SPARQL_TEST_QUERY)) from cause
        return Evidence(summary="connection established", command=SPARQL_TEST_QUERY)

    @check(NeptuneStep.GetRDFGraphSummary)
    def get_rdf_graph_summary(self) -> Evidence:
        command = "get_rdf_graph_summary(mode='basic')"
        try:
            summary = parse_graph_summary(self._client.client.get_rdf_graph_summary(mode="basic"))
        except Exception as cause:
            raise CheckError(cause, Evidence(command=command)) from cause
        return Evidence(summary=f"{len(summary.classes)} RDF classes available", command=command)
