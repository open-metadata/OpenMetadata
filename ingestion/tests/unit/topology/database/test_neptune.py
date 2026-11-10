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
Test the Neptune source: pg_schema() parsing, the schema computation lifecycle, the
topology and the test-connection checks, with the neptunedata client faked at the boundary.
Payloads follow the examples in the Neptune property graph schema documentation.
"""

from collections.abc import Callable
from copy import deepcopy
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import Evidence
from metadata.core.connections.test_connection.check import CheckError
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType, TableType
from metadata.generated.schema.entity.services.connections.database.neptuneConnection import (
    NeptuneConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.neptune.connection import (
    NEPTUNE_ERRORS,
    NEPTUNE_RDF_ERRORS,
    SPARQL_TEST_QUERY,
    NeptuneChecks,
    NeptuneRDFChecks,
    endpoint_url,
    host_and_port,
)
from metadata.ingestion.source.database.neptune.metadata import (
    NODES_SCHEMA,
    RELATIONSHIPS_SCHEMA,
    NeptuneSource,
)
from metadata.ingestion.source.database.neptune.queries import (
    NEPTUNE_PG_SCHEMA,
    NEPTUNE_PG_SCHEMA_COMPUTE,
)
from metadata.ingestion.source.database.neptune.rdf import NeptuneRDFStatisticsUnavailableError
from metadata.ingestion.source.database.neptune.schema import (
    NeptuneSchemaError,
    NeptuneSchemaFailedError,
    NeptuneSchemaMissingError,
    NeptuneSchemaTimeoutError,
    SchemaReader,
    SchemaState,
    classify,
    map_property_type,
    parse_schema,
    unwrap_payload,
)

COMPLETED = {
    "edgeLabelDetails": {
        "route": {"properties": {"dist": ["Int"]}},
        "contains": {"properties": {}},
    },
    "edgeLabels": ["route", "contains"],
    "status": {
        "concurrency": "16",
        "lastComputedTimestamp": "2026-06-04T23:58:17Z",
        "state": "Completed",
        "progressPercentage": "100",
    },
    "nodeLabels": ["version", "continent", "airport", "country"],
    "labelTriples": [
        {"~type": "route", "~from": "airport", "~to": "airport"},
        {"~type": "contains", "~from": "country", "~to": "airport"},
        {"~type": "contains", "~from": "continent", "~to": "airport"},
    ],
    "nodeLabelDetails": {
        "continent": {"properties": {"type": ["String"], "code": ["String"], "desc": ["String"]}},
        "airport": {
            "properties": {
                "city": ["String"],
                "lat": ["Double"],
                "runways": ["Int"],
                "elev": ["Int", "String"],
                "open": ["Bool"],
                "since": ["Date"],
            }
        },
        "country": {"properties": {"code": ["String"]}},
        "version": {"properties": {}},
    },
}

NOT_STARTED = {
    "edgeLabelDetails": {},
    "edgeLabels": [],
    "status": {"concurrency": "0", "state": "NotStarted", "progressPercentage": "0"},
    "nodeLabels": [],
    "labelTriples": [],
    "nodeLabelDetails": {},
}


def with_state(state: str, **status) -> dict:
    payload = deepcopy(COMPLETED)
    payload["status"] = {"state": state, **status}
    return payload


IN_PROGRESS = with_state("InProgress", progressPercentage="40")
STOPPED = with_state("Stopped", progressPercentage="40")
PAUSED = with_state("Paused", errorMessage="failover", progressPercentage="40")
FAILED = with_state("Failed", errorMessage="out of memory")


class FakeNeptune:
    """Answers the openCypher the connector sends: one pg_schema() response per read."""

    def __init__(self, reads: list, compute=None):
        self.reads = list(reads)
        self.compute = compute
        self.calls: list[str] = []

    def execute_open_cypher_query(self, openCypherQuery: str) -> dict:  # noqa: N803
        self.calls.append(openCypherQuery)
        if openCypherQuery == NEPTUNE_PG_SCHEMA_COMPUTE:
            if isinstance(self.compute, Exception):
                raise self.compute
            return {"results": []}
        if openCypherQuery == "RETURN 1":
            return {"results": [{"1": 1}]}
        response = self.reads.pop(0) if len(self.reads) > 1 else self.reads[0]
        if isinstance(response, Exception):
            raise response
        return {"results": [{"schema": response}]}


class FakeRDFNeptune:
    def __init__(self):
        self.calls: list[tuple[str, int | None]] = []

    def get_rdf_graph_summary(self, mode="basic"):
        self.calls.append(("summary", None))
        return {
            "statusCode": 200,
            "payload": {
                "graphSummary": {
                    "numQuads": 10,
                    "numClasses": 1,
                    "classes": ["http://example.org/Person"],
                    "predicates": [{"http://example.org/name": 1}],
                }
            },
        }

    def execute_sparql_query(self, query, timeout_seconds):
        self.calls.append((query, timeout_seconds))
        if query == SPARQL_TEST_QUERY:
            return []
        return [
            {
                "predicate": {"type": "uri", "value": "http://example.org/name"},
                "valueType": {
                    "type": "literal",
                    "value": "http://www.w3.org/2001/XMLSchema#string",
                },
            },
            {
                "predicate": {"type": "uri", "value": "http://example.org/knows"},
                "valueType": {"type": "literal", "value": "iri"},
                "targetClass": {"type": "uri", "value": "http://example.org/Person"},
            },
        ]


class Clock:
    def __init__(self):
        self.now = 0.0
        self.sleeps: list[float] = []

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds

    def __call__(self) -> float:
        return self.now


def reader(fake: FakeNeptune, clock: Clock, compute: bool = True, timeout: float = 100) -> SchemaReader:
    def run(query: str) -> list:
        return fake.execute_open_cypher_query(query)["results"]

    return SchemaReader(run, compute, timeout, poll_interval=5, sleep=clock.sleep, clock=clock)


def client_error(code: str, message: str = "error") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": message}}, "ExecuteOpenCypherQuery")


class TestParsing:
    def test_properties_and_types(self):
        airport = next(n for n in parse_schema(COMPLETED).nodes if n.name == "airport")
        assert {p.name: p.types for p in airport.properties} == {
            "city": ("String",),
            "elev": ("Int", "String"),
            "lat": ("Double",),
            "open": ("Bool",),
            "runways": ("Int",),
            "since": ("Date",),
        }

    def test_labels_without_properties_are_kept(self):
        graph = parse_schema(COMPLETED)
        assert {n.name for n in graph.nodes} == {"version", "continent", "airport", "country"}
        assert next(e for e in graph.edges if e.name == "contains").properties == ()

    def test_edge_endpoints_come_from_label_triples(self):
        edges = {e.name: e for e in parse_schema(COMPLETED).edges}
        assert edges["route"].endpoints == (("airport", "airport"),)
        assert edges["contains"].endpoints == (("continent", "airport"), ("country", "airport"))

    def test_an_edge_without_triples_has_no_endpoints(self):
        payload = deepcopy(COMPLETED)
        payload["labelTriples"] = []
        assert all(e.endpoints == () for e in parse_schema(payload).edges)

    def test_an_empty_schema_is_an_error_not_an_empty_graph(self):
        with pytest.raises(NeptuneSchemaError, match="without any node or edge labels"):
            parse_schema(
                with_state("Completed")
                | {"nodeLabels": [], "edgeLabels": [], "nodeLabelDetails": {}, "edgeLabelDetails": {}}
            )

    @pytest.mark.parametrize(
        ("neptune_types", "expected"),
        [
            (["String"], DataType.STRING),
            (["Int"], DataType.INT),
            (["Long"], DataType.BIGINT),
            (["Double"], DataType.DOUBLE),
            (["Bool"], DataType.BOOLEAN),
            (["Date"], DataType.TIMESTAMP),
            (["Int", "String"], DataType.UNKNOWN),
            (["Something"], DataType.UNKNOWN),
            ([], DataType.UNKNOWN),
        ],
    )
    def test_type_mapping(self, neptune_types, expected):
        assert map_property_type(neptune_types) == expected

    def test_payload_is_unwrapped_from_the_schema_column(self):
        assert unwrap_payload([{"schema": COMPLETED}]) == COMPLETED
        assert unwrap_payload([]) is None


class TestClassify:
    @pytest.mark.parametrize(
        ("payload", "state"),
        [
            (COMPLETED, SchemaState.READY),
            (NOT_STARTED, SchemaState.MISSING),
            (IN_PROGRESS, SchemaState.IN_PROGRESS),
            (STOPPED, SchemaState.INTERRUPTED),
            (PAUSED, SchemaState.INTERRUPTED),
        ],
    )
    def test_states(self, payload, state):
        assert classify(payload) is state

    def test_failed_carries_the_error_message(self):
        with pytest.raises(NeptuneSchemaFailedError, match="out of memory"):
            classify(FAILED)

    def test_unknown_state_is_an_error(self):
        with pytest.raises(NeptuneSchemaError, match="unrecognized"):
            classify({"status": {"state": "Teleporting"}})

    def test_no_payload_is_an_error(self):
        with pytest.raises(NeptuneSchemaError):
            classify(None)


class TestSchemaLifecycle:
    def test_completed_schema_is_read_without_computing(self):
        fake, clock = FakeNeptune([COMPLETED]), Clock()
        assert len(reader(fake, clock).read().nodes) == 4
        assert fake.calls == [NEPTUNE_PG_SCHEMA]

    def test_not_started_computes_then_polls_until_completed(self):
        fake, clock = FakeNeptune([NOT_STARTED, IN_PROGRESS, COMPLETED]), Clock()
        graph = reader(fake, clock).read()
        assert len(graph.edges) == 2
        assert fake.calls == [NEPTUNE_PG_SCHEMA, NEPTUNE_PG_SCHEMA_COMPUTE, NEPTUNE_PG_SCHEMA, NEPTUNE_PG_SCHEMA]
        assert clock.sleeps == [5, 10]

    def test_partial_results_are_never_returned_while_in_progress(self):
        fake, clock = FakeNeptune([IN_PROGRESS, COMPLETED]), Clock()
        reader(fake, clock, compute=False).read()
        assert NEPTUNE_PG_SCHEMA_COMPUTE not in fake.calls
        assert fake.calls.count(NEPTUNE_PG_SCHEMA) == 2

    @pytest.mark.parametrize("interrupted", [STOPPED, PAUSED])
    def test_an_interrupted_computation_is_resumed_through_compute(self, interrupted):
        fake, clock = FakeNeptune([interrupted, IN_PROGRESS, COMPLETED]), Clock()
        reader(fake, clock).read()
        assert NEPTUNE_PG_SCHEMA_COMPUTE in fake.calls

    def test_compute_disabled_fails_without_computing(self):
        fake, clock = FakeNeptune([NOT_STARTED]), Clock()
        with pytest.raises(NeptuneSchemaMissingError, match="never computed"):
            reader(fake, clock, compute=False).read()
        assert fake.calls == [NEPTUNE_PG_SCHEMA]

    def test_compute_disabled_reports_an_interrupted_computation(self):
        fake, clock = FakeNeptune([STOPPED]), Clock()
        with pytest.raises(NeptuneSchemaMissingError, match="interrupted"):
            reader(fake, clock, compute=False).read()

    def test_timeout_is_an_error_not_an_empty_result(self):
        fake, clock = FakeNeptune([NOT_STARTED, IN_PROGRESS]), Clock()
        with pytest.raises(NeptuneSchemaTimeoutError, match="schemaComputeTimeoutSeconds"):
            reader(fake, clock, timeout=20).read()
        assert clock.now >= 20

    def test_a_failed_computation_surfaces_its_message(self):
        fake, clock = FakeNeptune([NOT_STARTED, FAILED]), Clock()
        with pytest.raises(NeptuneSchemaFailedError, match="out of memory"):
            reader(fake, clock).read()

    def test_a_computation_stopped_by_someone_else_is_not_waited_on_forever(self):
        fake, clock = FakeNeptune([NOT_STARTED, STOPPED]), Clock()
        with pytest.raises(NeptuneSchemaError, match="stopped or paused"):
            reader(fake, clock).read()

    def test_compute_rejected_because_another_run_won_the_race_keeps_waiting(self):
        fake, clock = (
            FakeNeptune([NOT_STARTED, IN_PROGRESS, COMPLETED], compute=client_error("BadRequestException")),
            Clock(),
        )
        assert len(reader(fake, clock).read().nodes) == 4

    def test_compute_rejected_on_a_read_replica_surfaces(self):
        error = client_error("BadRequestException", "Schema cannot be computed on read replica")
        fake, clock = FakeNeptune([NOT_STARTED], compute=error), Clock()
        with pytest.raises(ClientError, match="read replica"):
            reader(fake, clock).read()

    def test_access_denied_on_read_propagates_without_computing(self):
        fake, clock = FakeNeptune([client_error("AccessDeniedException")]), Clock()
        with pytest.raises(ClientError):
            reader(fake, clock).read()
        assert NEPTUNE_PG_SCHEMA_COMPUTE not in fake.calls


def workflow_config(**connection) -> dict:
    return {
        "source": {
            "type": "neptune",
            "serviceName": "local_neptune",
            "serviceConnection": {
                "config": {
                    "type": "Neptune",
                    "hostPort": "graph.cluster-x.us-east-1.neptune.amazonaws.com:8182",
                    "awsConfig": {"awsRegion": "us-east-1"},
                    **connection,
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        },
        "sink": {"type": "metadata-rest", "config": {}},
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": "neptune"},
            }
        },
    }


def build_source(client: FakeNeptune, **connection) -> NeptuneSource:
    config = workflow_config(**connection)
    server = OpenMetadataWorkflowConfig.model_validate(config).workflowConfig.openMetadataServerConfig
    with (
        patch.object(NeptuneSource, "test_connection"),
        patch(
            "metadata.ingestion.source.database.neptune.connection.NeptuneConnection._get_client",
            return_value=client,
        ),
    ):
        source = NeptuneSource.create(config["source"], OpenMetadata(server))
    (database,) = source.get_database_names()
    source.context.get().upsert("database_service", "local_neptune")
    source.context.get().upsert("database", database)
    return source


def tables_in(source: NeptuneSource, schema_name: str) -> dict[str, CreateTableRequest]:
    source.context.get().upsert("database_schema", schema_name)
    requests = {}
    for table_name_and_type in source.get_tables_name_and_type() or []:
        (either,) = list(source.yield_table(table_name_and_type))
        request = either.right
        assert request is not None, either.left
        requests[request.name.root] = request
    return requests


def columns_of(request: CreateTableRequest) -> dict[str, Column]:
    return {column.name.root: column for column in request.columns}


@pytest.fixture(autouse=True)
def no_sleep():
    with patch("metadata.ingestion.source.database.neptune.schema.time.sleep"):
        yield


class TestSource:
    def test_database_defaults_to_default(self):
        assert list(build_source(FakeNeptune([COMPLETED])).get_database_names()) == ["default"]

    def test_configured_database_name_is_used(self):
        assert list(build_source(FakeNeptune([COMPLETED]), databaseName="airroutes").get_database_names()) == [
            "airroutes"
        ]

    def test_schemas_are_read_once(self):
        client = FakeNeptune([COMPLETED])
        source = build_source(client)
        assert source.get_schema_name_list() == [NODES_SCHEMA, RELATIONSHIPS_SCHEMA]
        list(source._get_filtered_schema_names(return_fqn=True, add_to_status=False))
        assert client.calls.count(NEPTUNE_PG_SCHEMA) == 1

    def test_relationships_can_be_disabled(self):
        source = build_source(FakeNeptune([COMPLETED]), includeRelationships=False)
        assert source.get_schema_name_list() == [NODES_SCHEMA]

    def test_node_labels_become_typed_tables(self):
        source = build_source(FakeNeptune([COMPLETED]))
        source.get_schema_name_list()
        tables = tables_in(source, NODES_SCHEMA)

        assert sorted(tables) == ["airport", "continent", "country", "version"]
        assert tables["airport"].tableType == TableType.Regular
        assert tables["airport"].databaseSchema.root == "local_neptune.default.nodes"
        airport = columns_of(tables["airport"])
        assert airport["runways"].dataType == DataType.INT
        assert airport["lat"].dataType == DataType.DOUBLE
        assert airport["open"].dataType == DataType.BOOLEAN
        assert airport["since"].dataType == DataType.TIMESTAMP
        assert airport["elev"].dataType == DataType.UNKNOWN
        assert airport["elev"].dataTypeDisplay == "Int | String"
        assert all(column.constraint is None for column in airport.values())
        assert tables["version"].columns == []

    def test_edge_labels_become_tables_describing_their_endpoints(self):
        source = build_source(FakeNeptune([COMPLETED]))
        source.get_schema_name_list()
        tables = tables_in(source, RELATIONSHIPS_SCHEMA)

        assert sorted(tables) == ["contains", "route"]
        assert columns_of(tables["route"])["dist"].dataType == DataType.INT
        assert "(airport)-[route]->(airport)" in tables["route"].description.root
        description = tables["contains"].description.root
        assert "(continent)-[contains]->(airport)" in description
        assert "(country)-[contains]->(airport)" in description

    def test_property_filter_drops_matching_columns(self):
        source = build_source(FakeNeptune([COMPLETED]), propertyFilterPattern={"excludes": ["^el.*"]})
        source.get_schema_name_list()
        assert "elev" not in columns_of(tables_in(source, NODES_SCHEMA)["airport"])

    def test_a_missing_schema_is_computed_when_allowed(self):
        client = FakeNeptune([NOT_STARTED, IN_PROGRESS, COMPLETED])
        source = build_source(client, schemaComputeTimeoutSeconds=600)
        assert source.get_schema_name_list() == [NODES_SCHEMA, RELATIONSHIPS_SCHEMA]
        assert NEPTUNE_PG_SCHEMA_COMPUTE in client.calls

    def test_a_missing_schema_is_a_failure_when_compute_is_disabled(self):
        client = FakeNeptune([NOT_STARTED])
        source = build_source(client, computeSchemaIfMissing=False)
        assert source.get_schema_name_list() == []
        assert NEPTUNE_PG_SCHEMA_COMPUTE not in client.calls
        (failure,) = source.status.failures
        assert "computeSchemaIfMissing" in model_str(failure.error)

    @pytest.mark.parametrize(
        ("reads", "expected"),
        [
            ([NOT_STARTED, FAILED], "out of memory"),
            ([client_error("AccessDeniedException")], "AccessDeniedException"),
            (
                [
                    with_state("Completed")
                    | {"nodeLabels": [], "edgeLabels": [], "nodeLabelDetails": {}, "edgeLabelDetails": {}}
                ],
                "empty",
            ),
        ],
    )
    def test_failures_are_reported_never_silent_empty_metadata(self, reads, expected):
        source = build_source(FakeNeptune(reads))
        assert source.get_schema_name_list() == []
        (failure,) = source.status.failures
        assert expected in model_str(failure.error)

    def test_deletion_hooks_leave_failed_schemas_alone(self):
        source = build_source(FakeNeptune([FAILED]))
        source.get_schema_name_list()
        source.source_config.markDeletedSchemas = True
        with patch(
            "metadata.ingestion.source.database.database_service.delete_entity_from_source",
            return_value=iter([]),
        ) as delete:
            list(source.mark_schemas_as_deleted())
        (sweep,) = delete.call_args_list
        assert "local_neptune.default.nodes" in sweep.kwargs["entity_source_state"]
        assert "local_neptune.default.relationships" in sweep.kwargs["entity_source_state"]


def run(check: Callable[[], Evidence | None]) -> Evidence:
    evidence = check()
    assert evidence is not None
    return evidence


class TestConnectionChecks:
    def checks(self, client: FakeNeptune, **connection) -> NeptuneChecks:
        config = workflow_config(**connection)["source"]["serviceConnection"]["config"]
        return NeptuneChecks(
            client=Borrowed(lambda: client),  # pyright: ignore[reportArgumentType]
            connection=NeptuneConnection.model_validate(config),
        )

    @pytest.mark.parametrize(
        ("host_port", "expected"),
        [
            ("db.neptune.amazonaws.com:8182", ("db.neptune.amazonaws.com", 8182)),
            ("db.neptune.amazonaws.com:8183", ("db.neptune.amazonaws.com", 8183)),
            ("db.neptune.amazonaws.com", ("db.neptune.amazonaws.com", 8182)),
        ],
    )
    def test_host_and_port(self, host_port, expected):
        assert host_and_port(host_port) == expected

    def test_endpoint_url_is_https(self):
        assert endpoint_url("db.example.com") == "https://db.example.com:8182"

    def test_check_access_probes_the_host_then_runs_a_query(self):
        client = FakeNeptune([COMPLETED])
        with patch("metadata.ingestion.source.database.neptune.connection.probe_or_fail") as probe:
            evidence = run(self.checks(client).check_access)
        probe.assert_called_once_with("graph.cluster-x.us-east-1.neptune.amazonaws.com", 8182)
        assert client.calls == ["RETURN 1"]
        assert evidence.summary == "connection established"

    def test_check_access_failure_carries_the_command(self):
        class Denied(FakeNeptune):
            def execute_open_cypher_query(self, openCypherQuery):  # noqa: N803
                raise client_error("AccessDeniedException")

        with (
            patch("metadata.ingestion.source.database.neptune.connection.probe_or_fail"),
            pytest.raises(CheckError) as raised,
        ):
            self.checks(Denied([])).check_access()
        assert isinstance(raised.value.__cause__, ClientError)

    def test_schema_check_never_starts_a_computation(self):
        client = FakeNeptune([NOT_STARTED])
        evidence = run(self.checks(client).get_property_graph_schema)
        assert client.calls == [NEPTUNE_PG_SCHEMA]
        assert evidence.caveat is not None
        assert evidence.caveat.title == "Schema not computed"
        assert "WriteDataViaQuery" in evidence.caveat.remediation

    def test_schema_check_reports_a_completed_schema(self):
        evidence = run(self.checks(FakeNeptune([COMPLETED])).get_property_graph_schema)
        assert evidence.summary == "property graph schema available"
        assert evidence.caveat is None

    def test_schema_check_flags_a_computation_in_progress(self):
        evidence = run(self.checks(FakeNeptune([IN_PROGRESS])).get_property_graph_schema)
        assert evidence.caveat.title == "Schema still computing"

    def test_schema_check_flags_an_interrupted_computation(self):
        evidence = run(self.checks(FakeNeptune([PAUSED])).get_property_graph_schema)
        assert evidence.caveat.title == "Schema incomplete"

    def test_schema_check_fails_on_a_failed_computation(self):
        with pytest.raises(CheckError) as raised:
            self.checks(FakeNeptune([FAILED])).get_property_graph_schema()
        assert isinstance(raised.value.__cause__, NeptuneSchemaFailedError)

    def test_labels_are_counted_from_the_schema_read_by_the_previous_step(self):
        checks = self.checks(FakeNeptune([COMPLETED]))
        checks.get_property_graph_schema()
        assert run(checks.get_node_labels).summary == "4 node labels enumerated"
        assert run(checks.get_relationship_types).summary == "2 edge labels enumerated"

    def test_labels_are_a_caveat_when_the_schema_is_not_available(self):
        checks = self.checks(FakeNeptune([NOT_STARTED]))
        checks.get_property_graph_schema()
        evidence = run(checks.get_node_labels)
        assert evidence.caveat is not None
        assert evidence.caveat.title == "Schema not available"

    @pytest.mark.parametrize(
        ("error", "title"),
        [
            (client_error("AccessDeniedException"), "Not authorized"),
            (
                client_error("BadRequestException", "Schema cannot be computed on read replica"),
                "Schema cannot be computed on a read replica",
            ),
            (RuntimeError("Unknown procedure neptune.graph.pg_schema"), "Schema procedure not supported"),
            (NeptuneSchemaFailedError("failed"), "Property graph schema unavailable"),
        ],
    )
    def test_errors_are_diagnosed(self, error, title):
        diagnosis = NEPTUNE_ERRORS.classify(error)
        assert diagnosis is not None
        assert diagnosis.title == title

    def test_not_authorized_names_the_iam_actions(self):
        diagnosis = NEPTUNE_ERRORS.classify(client_error("AccessDeniedException"))
        assert "neptune-db:ReadDataViaQuery" in diagnosis.remediation
        assert "neptune-db:WriteDataViaQuery" in diagnosis.remediation


class TestRDFSource:
    def test_rdf_class_becomes_a_table_with_predicate_columns(self):
        source = build_source(FakeRDFNeptune(), graphModel="rdf")
        assert source.get_schema_name_list() == ["classes"]

        tables = tables_in(source, "classes")
        person = tables["person"]
        assert person.description.root == "RDF class IRI: http://example.org/Person"
        assert person.databaseSchema.root == "local_neptune.default.classes"
        columns = columns_of(person)
        assert columns["name"].dataType == DataType.STRING
        assert columns["name"].description.root == "RDF predicate IRI: http://example.org/name"
        assert "Observed linked RDF classes (sampled): http://example.org/Person" in columns["knows"].description.root

    def test_rdf_metadata_uses_summary_then_bounded_class_query(self):
        client = FakeRDFNeptune()
        source = build_source(client, graphModel="rdf")
        source.get_schema_name_list()

        assert client.calls[0] == ("summary", None)
        (query, timeout) = client.calls[1]
        assert "LIMIT 1000" in query
        assert "LIMIT 101" in query
        assert "hint:queryTimeout 30000" in query
        assert timeout == 30

    def test_missing_rdf_statistics_is_an_ingestion_failure(self):
        class NoStatistics(FakeRDFNeptune):
            def get_rdf_graph_summary(self, mode="basic"):
                raise client_error("StatisticsNotAvailableException")

        source = build_source(NoStatistics(), graphModel="rdf")
        assert source.get_schema_name_list() == []
        (failure,) = source.status.failures
        assert "statistics are unavailable" in model_str(failure.error)
        assert "db.t3.medium" in model_str(failure.error)


class TestRDFConnectionChecks:
    def checks(self, client: FakeRDFNeptune) -> NeptuneRDFChecks:
        config = workflow_config(graphModel="rdf")["source"]["serviceConnection"]["config"]
        return NeptuneRDFChecks(
            client=Borrowed(lambda: client),  # pyright: ignore[reportArgumentType]
            connection=NeptuneConnection.model_validate(config),
        )

    def test_check_access_uses_read_only_limited_sparql(self):
        client = FakeRDFNeptune()
        with patch("metadata.ingestion.source.database.neptune.connection.probe_or_fail"):
            evidence = run(self.checks(client).check_access)

        assert client.calls == [(SPARQL_TEST_QUERY, 1)]
        assert "SELECT ?s" in evidence.command
        assert "LIMIT 1" in evidence.command

    def test_rdf_summary_check_is_read_only(self):
        client = FakeRDFNeptune()
        evidence = run(self.checks(client).get_rdf_graph_summary)

        assert client.calls == [("summary", None)]
        assert evidence.summary == "1 RDF classes available"

    def test_statistics_diagnostic_names_required_engine_and_instance_support(self):
        diagnosis = NEPTUNE_RDF_ERRORS.classify(NeptuneRDFStatisticsUnavailableError("statistics missing"))

        assert diagnosis.title == "RDF graph summary unavailable"
        assert "1.2.1.0" in diagnosis.remediation
        assert "db.t3.medium" in diagnosis.remediation
        assert "db.t4g.medium" in diagnosis.remediation
