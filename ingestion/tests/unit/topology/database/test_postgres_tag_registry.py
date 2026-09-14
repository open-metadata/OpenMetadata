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
"""Postgres policy definitions and table attachments through the topology."""

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.services.connections.database.postgresConnection import PostgresConnection
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.ingestion.source.database.timescale.metadata import TimescaleSource


@pytest.fixture(params=[PostgresSource, TimescaleSource])
def source(request):
    instance = object.__new__(request.param)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.service_connection = PostgresConnection(username="user", hostPort="localhost:5432", database="db")
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (("database_service", "svc"), ("database", "db"), ("database_schema", "schema")):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.return_value = []
    instance.metadata.get_by_name.side_effect = AssertionError("Tag label lookup must not access the server")
    instance.engine = MagicMock()
    return instance


def set_rows(source, rows):
    source.engine.connect.return_value.__enter__.return_value.execute.return_value.all.return_value = rows


def labels(source, table):
    return [label.tagFQN.root for label in source.get_tag_labels(table) or []]


def test_policy_stage_deduplicates_definitions_and_keeps_all_table_attachments(source):
    set_rows(
        source,
        [
            (1, "Mixed", "db", "schema", "first"),
            (2, "Mixed", "db", "schema", "second"),
            (2, "MIXED", "db", "schema", "second"),
        ],
    )
    with source._node_scope(source.topology.databaseSchema, "schema"):
        records = list(source._process_stage(source.topology.databaseSchema.stages[0], "schema"))
        assert all(record.left is None for record in records)
        assert [record.right.tag_request.name.root for record in records] == ["Mixed", "MIXED"]
        assert all(record.right.classification_request.name.root == "PostgresPolicyTags" for record in records)
        assert labels(source, "first") == ["PostgresPolicyTags.Mixed"]
        assert labels(source, "second") == ["PostgresPolicyTags.Mixed", "PostgresPolicyTags.MIXED"]
        assert labels(source, "untagged") == []
        assert source.get_schema_tag_labels("schema") is None
        assert source.get_database_tag_labels("db") is None
        for label in source.get_tag_labels("second"):
            assert (label.labelType.value, label.state.value, label.source.value) == (
                "Automated",
                "Suggested",
                "Classification",
            )
        assert getattr(source.context.get(), "tags", None) is None
    assert labels(source, "first") == []
    assert source.tags_registry.stats()["active_scopes"] == 0


def test_policy_names_resolve_to_existing_system_tags(source):
    source.service_connection.classificationName = "pii"
    classification = Classification(id=UUID(int=1), name="PII", description="System classification", provider="system")
    tag = Tag(
        id=UUID(int=2),
        name="Sensitive",
        description="System tag",
        provider="system",
        classification={"id": str(UUID(int=1)), "type": "classification", "name": "PII"},
    )
    source.metadata.es_search_from_fqn.side_effect = [[classification], [tag]]
    set_rows(source, [(1, "sensitive", "db", "schema", "first")])
    records = list(source._process_stage(source.topology.databaseSchema.stages[0], "schema"))
    assert len(records) == 1
    assert records[0].right.tag_request.name.root == "Sensitive"
    assert records[0].right.tag_request.description.root == "System tag"
    assert records[0].right.classification_request.name.root == "PII"
    assert labels(source, "first") == ["PII.Sensitive"]


def test_invalid_policy_does_not_discard_later_valid_policy(source):
    set_rows(source, [(1, 'bad"name', "db", "schema", "first"), (1, "Valid", "db", "schema", "first")])
    records = list(source._process_stage(source.topology.databaseSchema.stages[0], "schema"))
    assert len([record for record in records if record.left]) == 1
    assert [record.right.tag_request.name.root for record in records if record.right] == ["Valid"]
    assert labels(source, "first") == ["PostgresPolicyTags.Valid"]


def test_policy_query_failure_is_reported_without_attachments(source):
    source.engine.connect.return_value.__enter__.return_value.execute.side_effect = RuntimeError("query failed")
    records = list(source._process_stage(source.topology.databaseSchema.stages[0], "schema"))
    assert len(records) == 1
    assert "query failed" in records[0].left.error
    assert labels(source, "first") == []


def test_disabled_tags_skip_policy_extraction(source):
    source.source_config.includeTags = False
    source.engine.connect.side_effect = AssertionError("Disabled tags must not query policies")
    assert list(source._process_stage(source.topology.databaseSchema.stages[0], "schema")) == []
    assert labels(source, "first") == []


def test_quoted_entity_names_and_repeated_policy_across_schemas(source):
    source.context.get().upsert("database", "my.db")
    for schema in ("schema.a", "schema.b"):
        source.context.get().upsert("database_schema", schema)
        set_rows(source, [(1, "policy.value", "my.db", schema, "my.table")])
        with source._node_scope(source.topology.databaseSchema, schema):
            list(source._process_stage(source.topology.databaseSchema.stages[0], schema))
            assert labels(source, "my.table") == ['PostgresPolicyTags."policy.value"']
        assert labels(source, "my.table") == []
    assert source.tags_registry.stats()["live_labels"] == 0
