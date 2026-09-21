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
"""Athena Lake Formation tags through registry topology stages."""

from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.athena.client import AthenaLakeFormationClient
from metadata.ingestion.source.database.athena.metadata import AthenaSource


@pytest.fixture
def source():
    instance = object.__new__(AthenaSource)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (("database_service", "svc"), ("database", "catalog"), ("database_schema", "schema")):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()

    def search(*, entity_type, **kwargs):
        assert entity_type in (Classification, Tag), "Attachments must use source FQNs"
        return []

    instance.metadata.es_search_from_fqn.side_effect = search
    instance.metadata.get_by_name.side_effect = AssertionError("Tag label lookup must not access the server")
    instance.athena_lake_formation_client = object.__new__(AthenaLakeFormationClient)
    instance.athena_lake_formation_client.catalog_id = "123456789012"
    instance.athena_lake_formation_client.lake_formation_client = MagicMock()
    return instance


def tag(key, *values):
    return {"CatalogId": "123456789012", "TagKey": key, "TagValues": list(values)}


def response(source, data):
    source.athena_lake_formation_client.lake_formation_client.get_resource_lf_tags.return_value = data


def schema_stage(source, schema="schema"):
    return list(source._process_stage(source.topology.databaseSchema.stages[0], schema))


def table_stage(source, table="table"):
    return list(source._process_stage(source.topology.table.stages[0], (table, TableType.Regular)))


def fqns(labels):
    return [label.tagFQN.root for label in labels or []]


def test_schema_table_column_tags_keep_their_resource_boundaries(source):
    source.context.get().upsert("database_schema", "schema")
    response(source, {"LFTagOnDatabase": [tag("Environment", "Shared")]})
    definitions = schema_stage(source)
    response(
        source,
        {
            "LFTagsOnTable": [tag("Environment", "Shared"), tag("Case", "Mixed", "MIXED")],
            "LFTagsOnColumns": [{"Name": "value", "LFTags": [tag("ColumnClass", "Private", "Restricted")]}],
        },
    )
    definitions += table_stage(source)
    assert all(item.left is None for item in definitions)
    assert [item.right.tag_request.name.root for item in definitions] == [
        "Shared",
        "Mixed",
        "MIXED",
        "Private",
        "Restricted",
    ]
    assert fqns(source.get_schema_tag_labels("schema")) == ["Environment.Shared"]
    assert fqns(source.get_tag_labels("table")) == ["Environment.Shared", "Case.Mixed", "Case.MIXED"]
    assert fqns(source.get_column_tag_labels("table", {"name": "value"})) == [
        "ColumnClass.Private",
        "ColumnClass.Restricted",
    ]
    assert source.get_column_tag_labels("table", {"name": "untagged"}) is None
    assert source.get_tag_labels("other") is None
    assert source.get_database_tag_labels("catalog") is None
    assert getattr(source.context.get(), "tags", None) is None
    for label in source.get_tag_labels("table"):
        assert (label.labelType.value, label.state.value, label.source.value) == (
            "Automated",
            "Suggested",
            "Classification",
        )
    list(source.clear_schema_tag_scope())
    assert source.get_schema_tag_labels("schema") is None
    assert source.get_tag_labels("table") is None
    assert source.get_column_tag_labels("table", {"name": "value"}) is None
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("level", ["schema", "table", "column"])
def test_system_tags_resolve_at_every_supported_level(source, level):
    classification = Classification(id=UUID(int=1), name="PII", description="System classification", provider="system")
    system_tag = Tag(
        id=UUID(int=2),
        name="Sensitive",
        description="System tag",
        provider="system",
        classification={"id": str(UUID(int=1)), "type": "classification", "name": "PII"},
    )
    source.metadata.es_search_from_fqn.side_effect = [[classification], [system_tag]]
    lf_tag = tag("pii", "sensitive")
    if level == "schema":
        response(source, {"LFTagOnDatabase": [lf_tag]})
        records = schema_stage(source)
        labels = source.get_schema_tag_labels("schema")
    else:
        response(
            source,
            {"LFTagsOnTable": [lf_tag]}
            if level == "table"
            else {"LFTagsOnColumns": [{"Name": "value", "LFTags": [lf_tag]}]},
        )
        records = table_stage(source)
        labels = (
            source.get_tag_labels("table")
            if level == "table"
            else source.get_column_tag_labels("table", {"name": "value"})
        )
    assert len(records) == 1
    assert records[0].right.classification_request.name.root == "PII"
    assert records[0].right.tag_request.name.root == "Sensitive"
    assert records[0].right.tag_request.description.root == "System tag"
    assert fqns(labels) == ["PII.Sensitive"]


def test_invalid_and_empty_values_do_not_discard_valid_tags_or_columns(source):
    response(
        source,
        {
            "LFTagsOnTable": [tag("Class", 'bad"name', "", "  ", "Valid")],
            "LFTagsOnColumns": [{"Name": "value", "LFTags": [tag("ColumnClass", "Valid")]}],
        },
    )
    records = table_stage(source)
    assert len([item for item in records if item.left]) == 1
    assert [item.right.tag_request.name.root for item in records if item.right] == ["Valid", "Valid"]
    assert fqns(source.get_tag_labels("table")) == ["Class.Valid"]
    assert fqns(source.get_column_tag_labels("table", {"name": "value"})) == ["ColumnClass.Valid"]


def test_disabled_tags_do_not_call_lake_formation(source):
    source.source_config.includeTags = False
    response(source, {"LFTagOnDatabase": [tag("Class", "Value")], "LFTagsOnTable": [tag("Class", "Value")]})
    assert schema_stage(source) == []
    assert table_stage(source) == []
    source.athena_lake_formation_client.lake_formation_client.get_resource_lf_tags.assert_not_called()
    assert source.tags_registry.stats()["pending"] == 0


def test_unavailable_lake_formation_keeps_existing_skip_behavior(source):
    source.athena_lake_formation_client.lake_formation_client.get_resource_lf_tags.side_effect = RuntimeError(
        "access denied"
    )
    assert schema_stage(source) == []
    assert table_stage(source) == []
    assert source.get_tag_labels("table") is None


def test_quoted_names_and_repeated_tags_survive_schema_cleanup(source):
    for schema in ("schema.a", "schema.b"):
        source.context.get().upsert("database_schema", schema)
        response(
            source,
            {
                "LFTagsOnTable": [tag("Class.Name", "Value.Name")],
                "LFTagsOnColumns": [{"Name": "column.name", "LFTags": [tag("Class.Name", "Value.Name")]}],
            },
        )
        table_stage(source, "table.name")
        assert fqns(source.get_tag_labels("table.name")) == ['"Class.Name"."Value.Name"']
        assert fqns(source.get_column_tag_labels("table.name", {"name": "column.name"})) == [
            '"Class.Name"."Value.Name"'
        ]
        list(source.clear_schema_tag_scope())
        assert source.get_tag_labels("table.name") is None
        assert source.get_column_tag_labels("table.name", {"name": "column.name"}) is None
    assert source.tags_registry.stats()["live_labels"] == 0
