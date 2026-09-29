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
Test the Neo4j source using the topology, with the neo4j driver faked at the boundary
"""

from collections.abc import Callable
from unittest.mock import patch

import pytest
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from metadata.core.connections.lifetime import Borrowed
from metadata.core.connections.test_connection import Evidence
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, Constraint, DataType, TableType
from metadata.generated.schema.entity.services.connections.database.neo4jConnection import (
    Neo4jConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.ingestion.source.database.neo4j.connection import (
    NEO4J_ERRORS,
    Neo4jChecks,
    host_and_port,
)
from metadata.ingestion.source.database.neo4j.metadata import (
    NODES_SCHEMA,
    RELATIONSHIPS_SCHEMA,
    Neo4jSource,
)
from metadata.ingestion.source.database.neo4j.models import PropertySpec
from metadata.ingestion.source.database.neo4j.queries import (
    NEO4J_HOME_DATABASE,
    NEO4J_NODE_TYPE_PROPERTIES,
    NEO4J_REL_TYPE_PROPERTIES,
    NEO4J_TEST_NODE_LABELS,
)
from metadata.ingestion.source.database.neo4j.utils import (
    aggregate_element_types,
    map_property_type,
    parse_element_type,
)

NODE_ROWS = [
    {"nodeType": ":`Person`", "propertyName": "name", "propertyTypes": ["String"], "mandatory": True},
    {"nodeType": ":`Person`", "propertyName": "born", "propertyTypes": ["Long"], "mandatory": False},
    {"nodeType": ":`Actor`:`Person`", "propertyName": "name", "propertyTypes": ["String"], "mandatory": True},
    {"nodeType": ":`Actor`:`Person`", "propertyName": "agent", "propertyTypes": ["String"], "mandatory": True},
    {"nodeType": ":`Movie`", "propertyName": "title", "propertyTypes": ["String"], "mandatory": True},
    {"nodeType": ":`Movie`", "propertyName": "tagline", "propertyTypes": ["String"], "mandatory": False},
    {"nodeType": ":`Movie`", "propertyName": "louvain_1787104616131", "propertyTypes": ["Long"], "mandatory": False},
    {"nodeType": ":`Genre`", "propertyName": None, "propertyTypes": None, "mandatory": False},
]

REL_ROWS = [
    {"relType": ":`ACTED_IN`", "propertyName": "roles", "propertyTypes": ["StringArray"], "mandatory": True},
    {"relType": ":`FOLLOWS`", "propertyName": None, "propertyTypes": None, "mandatory": False},
]


class FakeRecord(dict):
    def data(self) -> dict:
        return dict(self)


class FakeDriver:
    """Answers the Cypher the connector sends; an Exception response is raised."""

    def __init__(self, responses: dict):
        self.responses = responses
        self.calls: list[tuple[str, str | None]] = []
        self.connectivity_verified = False

    def execute_query(self, query, parameters=None, database_=None, routing_=None):
        self.calls.append((query, database_))
        response = self.responses[query]
        if isinstance(response, Exception):
            raise response
        return [FakeRecord(row) for row in response], None, None

    def verify_connectivity(self):
        self.connectivity_verified = True

    def close(self):
        pass


def workflow_config(**connection) -> dict:
    return {
        "source": {
            "type": "neo4j",
            "serviceName": "local_neo4j",
            "serviceConnection": {
                "config": {
                    "type": "Neo4j",
                    "hostPort": "localhost:7687",
                    "username": "username",
                    "password": "password",
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
                "securityConfig": {"jwtToken": "neo4j"},
            }
        },
    }


def neo4j_error(code: str, message: str = "error") -> Neo4jError:
    # Built the way the driver hydrates server errors, so the subclass matches.
    return Neo4jError._hydrate_neo4j(code=code, message=message)


@pytest.fixture
def driver() -> FakeDriver:
    return FakeDriver(
        {
            NEO4J_HOME_DATABASE: [{"name": "neo4j"}],
            NEO4J_NODE_TYPE_PROPERTIES: NODE_ROWS,
            NEO4J_REL_TYPE_PROPERTIES: REL_ROWS,
            NEO4J_TEST_NODE_LABELS: [{"label": "Person"}, {"label": "Movie"}],
            "RETURN 1": [{"1": 1}],
        }
    )


def build_source(driver: FakeDriver, **connection) -> Neo4jSource:
    config = workflow_config(**connection)
    server = OpenMetadataWorkflowConfig.model_validate(config).workflowConfig.openMetadataServerConfig
    with (
        patch.object(Neo4jSource, "test_connection"),
        patch(
            "metadata.ingestion.source.database.neo4j.connection.Neo4jConnection._get_client",
            return_value=driver,
        ),
    ):
        source = Neo4jSource.create(config["source"], OpenMetadata(server))
    (database,) = source.get_database_names()
    source.context.get().upsert("database_service", "local_neo4j")
    source.context.get().upsert("database", database)
    return source


def tables_in(source: Neo4jSource, schema_name: str) -> dict[str, CreateTableRequest]:
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


def run(check: Callable[[], Evidence | None]) -> Evidence:
    evidence = check()
    assert evidence is not None
    return evidence


class TestParsing:
    def test_parse_element_type(self):
        assert parse_element_type(":`Person`") == ("Person",)
        assert parse_element_type(":`Actor`:`Person`") == ("Actor", "Person")
        assert parse_element_type(":`Odd``Label`") == ("Odd`Label",)
        assert parse_element_type("") == ()
        assert parse_element_type(None) == ()

    def test_multi_label_unions_types_and_demotes_mandatory(self):
        rows = [
            {"nodeType": ":`Person`", "propertyName": "id", "propertyTypes": ["String"], "mandatory": True},
            {"nodeType": ":`Actor`:`Person`", "propertyName": "id", "propertyTypes": ["Long"], "mandatory": True},
            {"nodeType": ":`Actor`:`Person`", "propertyName": "agent", "propertyTypes": ["String"], "mandatory": True},
        ]
        actor, person = aggregate_element_types(rows, "nodeType")
        # agent is missing from the :`Person`-only node type, so it is optional for Person
        assert person.properties == (
            PropertySpec(name="agent", types=("String",), mandatory=False),
            PropertySpec(name="id", types=("Long", "String"), mandatory=True),
        )
        # Actor only ever appears with Person, so both stay mandatory
        assert actor.properties == (
            PropertySpec(name="agent", types=("String",), mandatory=True),
            PropertySpec(name="id", types=("Long",), mandatory=True),
        )

    def test_element_without_properties(self):
        (genre,) = aggregate_element_types(
            [{"nodeType": ":`Genre`", "propertyName": None, "propertyTypes": None, "mandatory": False}],
            "nodeType",
        )
        assert genre.name == "Genre"
        assert genre.properties == ()


class TestTypeMapping:
    @pytest.mark.parametrize(
        ("neo4j_types", "expected"),
        [
            (["String"], (DataType.STRING, None)),
            (["Long"], (DataType.BIGINT, None)),
            (["Double"], (DataType.DOUBLE, None)),
            (["Boolean"], (DataType.BOOLEAN, None)),
            (["Date"], (DataType.DATE, None)),
            (["DateTime"], (DataType.TIMESTAMPZ, None)),
            (["LocalDateTime"], (DataType.TIMESTAMP, None)),
            (["LocalTime"], (DataType.TIME, None)),
            (["Duration"], (DataType.INTERVAL, None)),
            (["Point"], (DataType.POINT, None)),
            (["ByteArray"], (DataType.BYTES, None)),
            (["StringArray"], (DataType.ARRAY, DataType.STRING)),
            (["LongArray"], (DataType.ARRAY, DataType.BIGINT)),
        ],
    )
    def test_known_types(self, neo4j_types, expected):
        assert map_property_type(neo4j_types) == expected

    @pytest.mark.parametrize(
        ("neo4j_types", "expected"),
        [
            (["Long", "String"], (DataType.UNKNOWN, None)),
            ([], (DataType.UNKNOWN, None)),
            (["Vector"], (DataType.UNKNOWN, None)),
            (["VectorArray"], (DataType.ARRAY, DataType.UNKNOWN)),
        ],
    )
    def test_mixed_and_unknown_types_do_not_fail(self, neo4j_types, expected):
        assert map_property_type(neo4j_types) == expected


class TestSource:
    def test_database_defaults_to_the_home_database(self, driver):
        source = build_source(driver)
        assert list(source.get_database_names()) == ["neo4j"]

    def test_configured_database_is_used_without_a_lookup(self, driver):
        source = build_source(driver, databaseName="movies")
        assert list(source.get_database_names()) == ["movies"]
        assert (NEO4J_HOME_DATABASE, None) not in driver.calls

    def test_schemas_are_read_once_from_the_current_database(self, driver):
        source = build_source(driver)
        assert source.get_schema_name_list() == [NODES_SCHEMA, RELATIONSHIPS_SCHEMA]
        assert (NEO4J_NODE_TYPE_PROPERTIES, "neo4j") in driver.calls
        assert (NEO4J_REL_TYPE_PROPERTIES, "neo4j") in driver.calls

    def test_relationships_can_be_disabled(self, driver):
        source = build_source(driver, includeRelationships=False)
        assert source.get_schema_name_list() == [NODES_SCHEMA]
        assert all(query != NEO4J_REL_TYPE_PROPERTIES for query, _ in driver.calls)

    def test_node_labels_become_typed_tables(self, driver):
        source = build_source(driver)
        source.get_schema_name_list()
        tables = tables_in(source, NODES_SCHEMA)

        assert sorted(tables) == ["Actor", "Genre", "Movie", "Person"]
        assert tables["Person"].tableType == TableType.Regular
        assert tables["Person"].databaseSchema.root == "local_neo4j.neo4j.nodes"

        person = columns_of(tables["Person"])
        assert sorted(person) == ["agent", "born", "name"]
        assert person["name"].dataType == DataType.STRING
        assert person["name"].constraint == Constraint.NOT_NULL
        assert person["born"].dataType == DataType.BIGINT
        assert person["born"].dataTypeDisplay == "Long"
        assert person["born"].constraint is None
        assert person["agent"].constraint is None
        assert columns_of(tables["Actor"])["agent"].constraint == Constraint.NOT_NULL
        assert tables["Genre"].columns == []

    def test_relationship_types_become_tables(self, driver):
        source = build_source(driver)
        source.get_schema_name_list()
        tables = tables_in(source, RELATIONSHIPS_SCHEMA)

        assert sorted(tables) == ["ACTED_IN", "FOLLOWS"]
        roles = columns_of(tables["ACTED_IN"])["roles"]
        assert roles.dataType == DataType.ARRAY
        assert roles.arrayDataType == DataType.STRING
        assert roles.constraint == Constraint.NOT_NULL
        assert tables["FOLLOWS"].columns == []

    def test_property_filter_drops_matching_columns(self, driver):
        source = build_source(driver, propertyFilterPattern={"excludes": ["louvain.*"]})
        source.get_schema_name_list()
        movie = columns_of(tables_in(source, NODES_SCHEMA)["Movie"])
        assert sorted(movie) == ["tagline", "title"]

    def test_table_filter_applies_to_labels(self, driver):
        source = build_source(driver)
        source.source_config.tableFilterPattern = FilterPattern(includes=["Person"])
        source.get_schema_name_list()
        assert sorted(tables_in(source, NODES_SCHEMA)) == ["Person"]

    def test_a_failed_schema_read_skips_only_that_schema(self, driver):
        driver.responses[NEO4J_REL_TYPE_PROPERTIES] = neo4j_error("Neo.ClientError.Security.Forbidden")
        source = build_source(driver)
        assert source.get_schema_name_list() == [NODES_SCHEMA]
        assert len(source.status.failures) == 1
        assert "relationships" in model_str(source.status.failures[0].error)


class TestConnectionChecks:
    def checks(self, driver: FakeDriver, **connection) -> Neo4jChecks:
        config = workflow_config(**connection)["source"]["serviceConnection"]["config"]
        return Neo4jChecks(
            driver=Borrowed(lambda: driver),  # pyright: ignore[reportArgumentType]
            connection=Neo4jConnection.model_validate(config),
        )

    @pytest.mark.parametrize(
        ("host_port", "expected"),
        [
            ("localhost:7687", ("localhost", 7687)),
            ("graph.example.com:7688", ("graph.example.com", 7688)),
            ("graph.example.com", ("graph.example.com", 7687)),
        ],
    )
    def test_host_and_port(self, host_port, expected):
        assert host_and_port(host_port) == expected

    def test_check_access_probes_the_host_then_verifies_bolt(self, driver):
        with patch("metadata.ingestion.source.database.neo4j.connection.probe_or_fail") as probe:
            evidence = run(self.checks(driver).check_access)
        probe.assert_called_once_with("localhost", 7687)
        assert driver.connectivity_verified
        assert evidence.summary == "connection established"

    def test_get_databases_resolves_the_home_database(self, driver):
        evidence = run(self.checks(driver).get_databases)
        assert evidence.summary == "home database 'neo4j' accessible"
        assert ("RETURN 1", "neo4j") in driver.calls

    def test_get_node_labels_reports_a_count(self, driver):
        checks = self.checks(driver)
        checks.get_databases()
        evidence = run(checks.get_node_labels)
        assert evidence.summary == "2 node labels enumerated"
        assert evidence.caveat is None

    def test_an_empty_graph_is_a_caveat_not_a_failure(self, driver):
        driver.responses[NEO4J_TEST_NODE_LABELS] = []
        evidence = run(self.checks(driver, databaseName="neo4j").get_node_labels)
        assert evidence.caveat is not None
        assert evidence.caveat.title == "No node labels visible"

    @pytest.mark.parametrize(
        ("error", "title"),
        [
            (neo4j_error("Neo.ClientError.Security.Unauthorized"), "Authentication failed"),
            (neo4j_error("Neo.ClientError.Database.DatabaseNotFound"), "Database not found"),
            (neo4j_error("Neo.ClientError.Security.Forbidden"), "Insufficient privileges"),
            (ServiceUnavailable("Unable to retrieve routing information"), "Neo4j is unavailable"),
            (
                ServiceUnavailable("Couldn't connect: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed"),
                "TLS certificate not trusted",
            ),
        ],
    )
    def test_driver_errors_are_diagnosed(self, error, title):
        diagnosis = NEO4J_ERRORS.classify(error)
        assert diagnosis is not None
        assert diagnosis.title == title
