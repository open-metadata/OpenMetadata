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
"""Test bounded RDF schema discovery and SigV4 SPARQL requests."""

from unittest.mock import Mock, patch

import pytest
from botocore.credentials import Credentials
from botocore.exceptions import ClientError

from metadata.generated.schema.entity.data.table import DataType
from metadata.ingestion.source.database.neptune.connection import NeptuneDataClient
from metadata.ingestion.source.database.neptune.rdf import (
    DEFAULT_QUERY_TIMEOUT_SECONDS,
    RDF_LANG_STRING,
    NeptuneRDFSchemaError,
    NeptuneRDFStatisticsUnavailableError,
    build_class_query,
    iri_names,
    parse_class_properties,
    parse_graph_summary,
    rdf_data_type,
    read_graph_schema,
    sparql_iri_ref,
)

PERSON = "http://example.org/Person"
NAME = "http://example.org/name"
KNOWS = "http://example.org/knows"
XSD_STRING = "http://www.w3.org/2001/XMLSchema#string"


def summary(classes: list[str] | None = None, num_quads: int = 2) -> dict:
    return {
        "statusCode": 200,
        "payload": {
            "graphSummary": {
                "numDistinctSubjects": 1,
                "numDistinctPredicates": 2,
                "numQuads": num_quads,
                "numClasses": len(classes or []),
                "classes": classes or [],
                "predicates": [{NAME: 1}],
            }
        },
    }


def binding(predicate: str, value_type: str, target_class: str | None = None) -> dict:
    result = {
        "predicate": {"type": "uri", "value": predicate},
        "valueType": {"type": "literal", "value": value_type},
    }
    if target_class:
        result["targetClass"] = {"type": "uri", "value": target_class}
    return result


class FakeRDFClient:
    def __init__(self, classes: list[str], rows: list[dict] | None = None):
        self.response = summary(classes)
        self.rows = rows or []
        self.queries: list[tuple[str, int]] = []

    def get_rdf_graph_summary(self, mode: str = "basic") -> dict:
        assert mode == "basic"
        return self.response

    def execute_sparql_query(self, query: str, timeout_seconds: int) -> list[dict]:
        self.queries.append((query, timeout_seconds))
        return self.rows


class TestRDFSummary:
    def test_summary_classes_are_unique_and_sorted(self):
        result = parse_graph_summary(summary([PERSON, "http://example.org/Company", PERSON]))
        assert result.classes == ("http://example.org/Company", PERSON)
        assert result.num_quads == 2

    def test_malformed_summary_is_not_treated_as_an_empty_graph(self):
        with pytest.raises(NeptuneRDFSchemaError, match="no RDF graph summary"):
            parse_graph_summary({"payload": {}})

    def test_quads_without_classes_are_reported(self):
        with pytest.raises(NeptuneRDFSchemaError, match="no classes"):
            parse_graph_summary(summary([], num_quads=1))

    def test_statistics_not_available_has_actionable_error(self):
        error = ClientError(
            {"Error": {"Code": "StatisticsNotAvailableException", "Message": "statistics are not available"}},
            "GetRDFGraphSummary",
        )

        class NoStatistics(FakeRDFClient):
            def get_rdf_graph_summary(self, mode: str = "basic") -> dict:
                raise error

        with pytest.raises(NeptuneRDFStatisticsUnavailableError, match=r"db\.t3\.medium"):
            read_graph_schema(NoStatistics([PERSON]), 10, 10, 10, 5)


class TestRDFQueries:
    def test_class_query_has_sample_predicate_and_timeout_limits(self):
        query = build_class_query(PERSON, sample_size=17, max_predicates=9, timeout_seconds=5)

        assert query.count("LIMIT 17") == 2
        assert "LIMIT 10" in query
        assert "hint:queryTimeout 5000" in query
        assert f"rdf:type <{PERSON}>" in query

    def test_iri_is_escaped_before_embedding_in_query(self):
        assert sparql_iri_ref("https://example.org/Person> }") == "<https://example.org/Person%3E%20%7D>"

    def test_query_limits_must_be_positive(self):
        with pytest.raises(ValueError, match="must be positive"):
            build_class_query(PERSON, sample_size=0, max_predicates=1, timeout_seconds=1)

    def test_predicates_types_and_links_are_parsed(self):
        properties, truncated = parse_class_properties(
            [
                binding(NAME, XSD_STRING),
                binding(KNOWS, "iri", PERSON),
                binding(NAME, f"{XSD_STRING}"),
            ],
            max_predicates=5,
        )

        assert not truncated
        by_name = {prop.name: prop for prop in properties}
        assert by_name["name"].types == (XSD_STRING,)
        assert by_name["knows"].target_classes == (PERSON,)
        assert rdf_data_type(by_name["name"].types) == DataType.STRING
        assert rdf_data_type(("iri",)) == DataType.STRING
        assert rdf_data_type((RDF_LANG_STRING,)) == DataType.STRING
        assert rdf_data_type((XSD_STRING, "iri")) == DataType.UNKNOWN
        assert rdf_data_type(("http://www.w3.org/2001/XMLSchema#integer",)) == DataType.UNKNOWN

    def test_invalid_sparql_binding_fails_explicitly(self):
        with pytest.raises(NeptuneRDFSchemaError, match="without a predicate"):
            parse_class_properties([{"valueType": {"type": "literal", "value": XSD_STRING}}], 5)

    def test_iri_names_are_sanitized_and_collision_free(self):
        iris = ["http://one.example/Person", "https://two.example/Person", "http://one.example/Name-Value"]
        names = iri_names(iris)

        assert len(set(names.values())) == len(iris)
        assert names == iri_names(list(reversed(iris)))
        assert all(name.replace("_", "").isalnum() for name in names.values())
        assert names["http://one.example/Name-Value"] == "name_value"

    def test_class_and_predicate_caps_are_applied(self):
        client = FakeRDFClient(
            [PERSON, "http://example.org/Company", "http://example.org/Place"],
            [binding(NAME, XSD_STRING), binding(KNOWS, "iri", PERSON)],
        )
        graph = read_graph_schema(client, max_classes=2, max_predicates=1, sample_size=3, timeout_seconds=7)

        assert len(graph.classes) == 2
        assert graph.total_classes == 3
        assert graph.classes_truncated
        assert all(element.predicates_truncated for element in graph.classes)
        assert len(client.queries) == 2
        assert all(timeout == 7 and "LIMIT 3" in query and "LIMIT 2" in query for query, timeout in client.queries)


class TestSPARQLClient:
    def test_posts_form_encoded_query_with_sigv4_and_bounded_timeout(self):
        class FakeSession:
            region_name = "us-east-1"

            def client(self, service_name: str, endpoint_url: str):
                assert service_name == "neptunedata"
                assert endpoint_url == "https://graph.example.com:8182"
                return FakeDataClient()

            def get_credentials(self):
                return Credentials("access-key", "secret-key")

        class FakeDataClient:
            def close(self) -> None:
                pass

        class Response:
            status_code = 200

            def json(self):
                return {"results": {"bindings": []}}

        http_session = Mock()
        http_session.post.return_value = Response()
        query = "SELECT ?s WHERE { ?s ?p ?o } LIMIT 1"
        with patch(
            "metadata.ingestion.source.database.neptune.connection.requests.Session",
            return_value=http_session,
        ) as session:
            client = NeptuneDataClient(FakeSession(), "graph.example.com")
            assert client.execute_sparql_query(query, timeout_seconds=DEFAULT_QUERY_TIMEOUT_SECONDS) == []
            assert client.execute_sparql_query(query, timeout_seconds=DEFAULT_QUERY_TIMEOUT_SECONDS) == []
            session.assert_called_once_with()
            assert session.return_value.post.call_count == 2
            kwargs = session.return_value.post.call_args.kwargs
            assert kwargs["data"] == "query=SELECT+%3Fs+WHERE+%7B+%3Fs+%3Fp+%3Fo+%7D+LIMIT+1"
            assert kwargs["timeout"] == (10, DEFAULT_QUERY_TIMEOUT_SECONDS + 5)
            assert kwargs["allow_redirects"] is False
            assert "/us-east-1/neptune-db/aws4_request" in kwargs["headers"]["Authorization"]
            client.close()
            session.return_value.close.assert_called_once()
