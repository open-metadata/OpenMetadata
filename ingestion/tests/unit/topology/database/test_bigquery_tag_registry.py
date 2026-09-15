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
"""BigQuery labels and policy tags through the database registry topology."""

from threading import Lock
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from google.cloud.bigquery import Dataset, SchemaField, Table
from google.cloud.bigquery.schema import PolicyTagList
from google.cloud.datacatalog_v1 import PolicyTag, Taxonomy

from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource, get_columns
from metadata.utils.lru_cache import LRUCache


@pytest.fixture
def source():
    instance = object.__new__(BigquerySource)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True, extractJsonSchema=False)
    instance.service_connection = SimpleNamespace(includePolicyTags=True, taxonomyProjectID=None, taxonomyLocation="us")
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (("database_service", "svc"), ("database", "project"), ("database_schema", "dataset")):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()

    def search(*, entity_type, **kwargs):
        assert entity_type in (Classification, Tag), "Attachment FQNs must not depend on search"
        return []

    instance.metadata.es_search_from_fqn.side_effect = search
    instance.metadata.get_by_name.side_effect = AssertionError("Label lookup must not access the server")
    instance.client = MagicMock()
    instance.client.get_dataset.return_value = Dataset("project.dataset")
    instance.client.get_table.return_value = Table("project.dataset.my_table")
    instance._table_obj_cache = LRUCache(10)
    instance._dataset_obj_cache = LRUCache(10)
    instance._policy_tag_cache = {}
    instance._taxonomy_cache = {}
    instance._taxonomy_to_tags = {}
    instance._policy_tag_prefetch_key = None
    instance._policy_tag_lock = Lock()
    instance._policy_tag_client = MagicMock()
    instance._policy_tag_client.list_taxonomies.return_value = []
    instance._policy_tag_client.get_taxonomy.side_effect = AssertionError("Unexpected taxonomy fallback")
    instance._policy_tag_client.get_policy_tag.side_effect = AssertionError("Unexpected policy fallback")
    return instance


def schema_stage(source, name="dataset"):
    source.context.get().upsert("database_schema", name)
    return list(source._process_stage(source.topology.databaseSchema.stages[0], name))


def table_stage(source):
    return list(source._process_stage(source.topology.table.stages[0], ("my_table", TableType.Regular)))


def fqns(labels):
    return [label.tagFQN.root for label in labels or []]


def definitions(records):
    assert not any(record.left for record in records)
    assert all(record.right.fqn is None for record in records)
    return {(record.right.tag_request.classification.root, record.right.tag_request.name.root) for record in records}


def policies(source, taxonomies):
    """Provide taxonomy and policy resources at the Google API boundary."""
    source._policy_tag_client.list_taxonomies.return_value = [
        Taxonomy(name=name, display_name=display) for name, (display, _) in taxonomies.items()
    ]

    def list_tags(*, parent):
        return [PolicyTag(name=name, display_name=display) for name, display in taxonomies[parent][1]]

    source._policy_tag_client.list_policy_tags.side_effect = list_tags


def policy_field(name, resource):
    return SchemaField(name, "STRING", policy_tags=PolicyTagList(names=[resource]))


def test_dataset_and_table_labels_share_definitions_but_not_attachments(source):
    source.client.get_dataset.return_value.labels = {"env": "prod", "empty": ""}
    source.client.get_table.return_value.labels = {"env": "prod", "team": "analytics"}
    records = schema_stage(source) + table_stage(source)
    assert definitions(records) == {("env", "prod"), ("team", "analytics")}
    assert len(records) == 2
    assert fqns(source.get_schema_tag_labels("dataset")) == ["env.prod"]
    schema_request = next(iter(source.yield_database_schema("dataset"))).right
    assert fqns(schema_request.tags) == ["env.prod"]
    assert schema_request.database.root == "svc.project"
    assert fqns(source.get_tag_labels("my_table")) == ["env.prod", "team.analytics"]
    assert source.get_tag_labels("other") is None
    assert source.get_database_tag_labels("project") is None
    assert getattr(source.context.get(), "tags", None) is None


@pytest.mark.parametrize("level", ["dataset", "table", "policy"])
def test_system_tags_are_canonical_at_each_bigquery_level(source, level):
    classification = Classification(id=UUID(int=1), name="PII", description="System classification", provider="system")
    tag = Tag(
        id=UUID(int=2),
        name="Sensitive",
        description="System tag",
        provider="system",
        classification={"id": str(UUID(int=1)), "type": "classification", "name": "PII"},
    )
    source.metadata.es_search_from_fqn.side_effect = lambda *, entity_type, **kwargs: (
        [classification] if entity_type is Classification else [tag]
    )
    if level == "dataset":
        source.client.get_dataset.return_value.labels = {"pii": "sensitive"}
    elif level == "table":
        source.client.get_table.return_value.labels = {"pii": "sensitive"}
    else:
        policies(source, {"taxonomy": ("pii", [("policy", "sensitive")])})
        source.client.get_table.return_value.schema = [policy_field("id", "policy")]
    records = schema_stage(source) + table_stage(source)
    assert definitions(records) == {("PII", "Sensitive")}
    assert len(records) == 1
    assert records[0].right.tag_request.description.root == "System tag"
    target = {
        "dataset": "svc.project.dataset",
        "table": "svc.project.dataset.my_table",
        "policy": "svc.project.dataset.my_table.id",
    }[level]
    assert fqns(source.get_tag_by_fqn(target)) == ["PII.Sensitive"]


def test_nested_policy_tags_keep_full_paths_through_column_assembly(source):
    policies(
        source,
        {
            "taxonomy_one": ("Privacy", [("policy_one", "Mixed"), ("unused", "Unused")]),
            "taxonomy_two": ("Privacy", [("policy_two", "MIXED")]),
        },
    )
    fields = [
        SchemaField("left", "RECORD", fields=[policy_field("id", "policy_one")]),
        SchemaField("right", "RECORD", mode="REPEATED", fields=[policy_field("id", "policy_two")]),
        SchemaField("plain", "STRING"),
    ]
    source.client.get_table.return_value.schema = fields
    records = schema_stage(source) + table_stage(source)
    assert definitions(records) == {("Privacy", "Mixed"), ("Privacy", "MIXED"), ("Privacy", "Unused")}
    assert len(records) == 3
    inspector = MagicMock()
    inspector.get_pk_constraint.return_value = {}
    inspector.get_unique_constraints.return_value = []
    inspector.get_foreign_keys.return_value = []
    columns, _, _ = source.get_columns_and_constraints("dataset", "my_table", "project", inspector)
    assert [column.name.root for column in columns] == ["left", "right", "plain"]
    assert fqns(columns[0].children[0].tags) == ["Privacy.Mixed"]
    assert fqns(columns[1].children[0].tags) == ["Privacy.MIXED"]
    assert all(not column.tags for column in columns)
    assert source.get_tag_labels("my_table") is None
    assert source.get_schema_tag_labels("dataset") is None
    assert list(fields[0].fields[0].policy_tags.names) == ["policy_one"]
    assert list(fields[1].fields[0].policy_tags.names) == ["policy_two"]


def test_fallback_definitions_are_emitted_before_column_lookup_without_io(source):
    resource = "projects/project/locations/us/taxonomies/taxonomy/policyTags/policy"
    source.client.get_table.return_value.schema = [policy_field("id", resource)]
    source._policy_tag_client.get_taxonomy.side_effect = lambda *, name: (
        Taxonomy(name=name, display_name="Privacy") if name == resource.split("/policyTags/", maxsplit=1)[0] else None
    )
    source._policy_tag_client.get_policy_tag.side_effect = lambda *, name: (
        PolicyTag(name=name, display_name="Restricted") if name == resource else None
    )
    assert schema_stage(source) == []
    assert definitions(table_stage(source)) == {("Privacy", "Restricted")}
    source._policy_tag_client.get_taxonomy.side_effect = AssertionError("Lookup must not access Google")
    source._policy_tag_client.get_policy_tag.side_effect = AssertionError("Lookup must not access Google")
    column = get_columns(source.client.get_table.return_value.schema)[0]
    for _ in range(2):
        assert fqns(source.get_column_tag_labels("my_table", column)) == ["Privacy.Restricted"]
    assert list(column["policy_tags"].names) == [resource]


def test_policy_resource_ids_and_quoted_asset_names_do_not_collide(source):
    source.context.get().upsert("database_service", "svc.with.dots")
    policies(
        source,
        {
            "taxonomy_one": ("Privacy", [("policy_one", "Restricted")]),
            "taxonomy_two": ("Security", [("policy_two", "Restricted")]),
        },
    )
    source.client.get_table.return_value.schema = [
        policy_field("field.with.dots", "policy_one"),
        policy_field("other", "policy_two"),
    ]
    assert definitions(schema_stage(source) + table_stage(source)) == {
        ("Privacy", "Restricted"),
        ("Security", "Restricted"),
    }
    columns = get_columns(source.client.get_table.return_value.schema)
    assert fqns(source.get_column_tag_labels("my_table", columns[0])) == ["Privacy.Restricted"]
    assert fqns(source.get_column_tag_labels("my_table", columns[1])) == ["Security.Restricted"]
    assert fqns(source.get_tag_by_fqn('"svc.with.dots".project.dataset.my_table."field.with.dots"')) == [
        "Privacy.Restricted"
    ]


def test_invalid_definition_does_not_discard_other_labels(source):
    source.client.get_table.return_value.labels = {"bad": 'invalid"name', "env": "prod"}
    records = schema_stage(source) + table_stage(source)
    assert len([record for record in records if record.left]) == 1
    assert definitions([record for record in records if record.right]) == {("env", "prod")}
    assert fqns(source.get_tag_labels("my_table")) == ["env.prod"]


def test_denied_policy_fallback_preserves_other_tags_and_columns(source):
    policies(source, {"taxonomy": ("Privacy", [("cached", "Restricted")])})
    source.client.get_table.return_value.labels = {"env": "prod"}
    source.client.get_table.return_value.schema = [policy_field("denied", "missing"), policy_field("ok", "cached")]
    source._policy_tag_client.get_taxonomy.side_effect = PermissionError("denied")
    assert definitions(schema_stage(source) + table_stage(source)) == {("Privacy", "Restricted"), ("env", "prod")}
    columns = get_columns(source.client.get_table.return_value.schema)
    assert source.get_column_tag_labels("my_table", columns[0]) is None
    assert fqns(source.get_column_tag_labels("my_table", columns[1])) == ["Privacy.Restricted"]
    assert fqns(source.get_tag_labels("my_table")) == ["env.prod"]


def test_disabled_tags_do_not_extract_or_attach(source):
    source.source_config.includeTags = False
    source.client.get_dataset.side_effect = AssertionError("Tags disabled must not extract labels")
    source.client.get_table.side_effect = AssertionError("Tags disabled must not extract labels")
    source._policy_tag_client.list_taxonomies.side_effect = AssertionError("Tags disabled must not extract policies")
    assert schema_stage(source) + table_stage(source) == []
    assert source.get_tag_labels("my_table") is None
    assert source.get_column_tag_labels("my_table", {"name": "id"}) is None


def test_disabled_policy_tags_preserve_labels(source):
    source.service_connection.includePolicyTags = False
    source._policy_tag_client.list_taxonomies.side_effect = AssertionError("Policy tags disabled")
    source.client.get_dataset.return_value.labels = {"env": "prod"}
    source.client.get_table.return_value.labels = {"team": "analytics"}
    source.client.get_table.return_value.schema = [policy_field("id", "policy")]
    assert definitions(schema_stage(source) + table_stage(source)) == {("env", "prod"), ("team", "analytics")}
    assert fqns(source.get_tag_labels("my_table")) == ["team.analytics"]
    assert source.get_column_tag_labels("my_table", get_columns(source.client.get_table.return_value.schema)[0]) is None


def test_empty_policy_list_and_untagged_columns_are_ignored(source):
    source.client.get_table.return_value.schema = [SchemaField("id", "STRING", policy_tags=PolicyTagList(names=[]))]
    assert schema_stage(source) + table_stage(source) == []
    assert source.get_column_tag_labels("my_table", get_columns(source.client.get_table.return_value.schema)[0]) is None


def test_untagged_nested_field_does_not_inherit_same_named_top_level_tag(source):
    policies(source, {"taxonomy": ("Privacy", [("policy", "Restricted")])})
    source.client.get_table.return_value.schema = [
        policy_field("id", "policy"),
        SchemaField("record", "RECORD", fields=[SchemaField("id", "STRING")]),
    ]
    schema_stage(source)
    table_stage(source)
    columns = get_columns(source.client.get_table.return_value.schema)
    assert fqns(source.get_column_tag_labels("my_table", columns[0])) == ["Privacy.Restricted"]
    assert source.get_column_tag_labels("my_table", columns[1]["children"][0]) is None


def test_schema_scope_cleanup_does_not_drop_later_attachments(source):
    source.client.get_dataset.return_value.labels = {"env": "prod"}
    source.client.get_table.return_value.labels = {"env": "prod"}
    emitted = []
    for name in ("first", "second"):
        source.context.get().upsert("database_schema", name)
        emitted += schema_stage(source, name) + table_stage(source)
        assert fqns(source.get_schema_tag_labels(name)) == ["env.prod"]
        assert fqns(source.get_tag_labels("my_table")) == ["env.prod"]
        assert source.get_tag_by_fqn("svc.project.filtered.my_table") is None
        list(source.clear_schema_tag_scope())
        assert source.get_schema_tag_labels(name) is None
        assert source.get_tag_labels("my_table") is None
    assert len(emitted) == 1
    assert source.tags_registry.stats()["live_entities"] == 0
