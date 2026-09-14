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
"""Database tag registration, lookup and scope ownership."""

from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.domain.tags import TagDefinition
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.ingestion.source.database.mongodb.metadata import MongodbSource
from metadata.ingestion.source.database.mysql.metadata import MysqlSource
from metadata.ingestion.source.database.postgres.metadata import PostgresSource
from metadata.ingestion.source.database.snowflake.metadata import SnowflakeSource


@pytest.fixture
def source():
    # These tests exercise source stages without opening an external database connection.
    instance = object.__new__(SnowflakeSource)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    instance.context.get().upsert("database_service", "svc")
    instance.context.get().upsert("database", "db")
    instance.context.get().upsert("database_schema", "schema")
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.return_value = []
    instance.metadata.get_by_name.side_effect = AssertionError("Entity tag lookup must not access the server")
    return instance


def test_snowflake_stage_emits_and_attaches_without_tag_context(source):
    source.database_tags_map = {"db": [{"tag_name": "Class", "tag_value": "Value"}]}
    stage = source.topology.database.stages[0]
    with source._node_scope(source.topology.database, "db"):
        records = list(source._process_stage(stage, "db"))
        assert len(records) == 1
        assert records[0].right.tag_request.name.root == "Value"
        assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == ["Class.Value"]
        assert getattr(source.context.get(), "tags", None) is None
        assert source.get_tag_by_fqn("svc.db.schema.untagged") is None
    assert source.tags_registry.stats()["active_scopes"] == 0
    assert source.get_database_tag_labels("db") is None


def test_snowflake_stage_reports_bad_definition_and_emits_valid_one(source):
    source.database_tags_map = {
        "db": [
            {"tag_name": "Class", "tag_value": '{"invalid": "name"}'},
            {"tag_name": "Class", "tag_value": "Valid"},
        ]
    }
    records = list(source._process_stage(source.topology.database.stages[0], "db"))
    failures = [record.left for record in records if record.left]
    definitions = [record.right for record in records if record.right]
    assert len(failures) == 1
    assert "Invalid name" in failures[0].error
    assert [record.tag_request.name.root for record in definitions] == ["Valid"]
    assert [label.tagFQN.root for label in source.get_database_tag_labels("db")] == ["Class.Valid"]


def test_disabled_tags_do_not_register_or_emit(source):
    source.source_config.includeTags = False
    source.database_tags_map = {"db": [{"tag_name": "Class", "tag_value": "Value"}]}
    assert list(source._process_stage(source.topology.database.stages[0], "db")) == []
    assert source.get_database_tag_labels("db") is None
    assert source.tags_registry.stats()["pending"] == 0
    assert source.tags_registry.stats()["active_scopes"] == 0


@pytest.mark.parametrize(
    "node_name,hook",
    [("database", "yield_database_tag"), ("databaseSchema", "yield_tag"), ("table", "yield_table_tags")],
)
def test_closing_tag_stage_releases_publication_and_preserves_pending(source, monkeypatch, node_name, hook):
    monkeypatch.setattr(source, hook, lambda _: [])
    for name in ("First", "Second"):
        source.tags_registry.define(TagDefinition("Class", name, "", ""))

    retained = {}

    def retain_generator(method):
        def capture(*args, **kwargs):
            generator = method(*args, **kwargs)
            retained.setdefault(method.__name__, generator)
            return generator

        return capture

    # Retained iterators must close explicitly, without relying on CPython reference counting.
    monkeypatch.setattr(source.tags_registry, "drain", retain_generator(source.tags_registry.drain))
    monkeypatch.setattr(source, "_run_stage_processor", retain_generator(source._run_stage_processor))
    stage = source._process_stage(getattr(source.topology, node_name).stages[0], "item")
    assert next(stage).right.tag_request.name.root == "First"
    stage.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        try:
            remaining = pool.submit(lambda: list(source.tags_registry.drain())).result(timeout=5)
        finally:
            for generator in retained.values():
                generator.close()
    assert [record.tag_request.name.root for record in remaining] == ["First", "Second"]
    assert source.tags_registry.stats()["pending"] == 0


def test_shared_registration_resolves_system_tags(source):
    classification = Classification(id=UUID(int=1), name="PII", description="System classification", provider="system")
    system_tag = Tag(
        id=UUID(int=2),
        name="Sensitive",
        description="System tag",
        provider="system",
        classification={"id": str(UUID(int=1)), "type": "classification", "name": "PII"},
    )
    source.metadata.es_search_from_fqn.side_effect = [[classification], [system_tag]]
    tag = source.define_tag(
        classification_name="pii",
        tag_name="sensitive",
        classification_description="Source classification",
        tag_description="Source tag",
    )
    source.attach_tag(entity_fqn="svc.db.schema.table", tag=tag)
    records = list(source.tags_registry.drain())
    assert records[0].classification_request.name.root == "PII"
    assert records[0].tag_request.name.root == "Sensitive"
    assert records[0].tag_request.description.root == "System tag"
    assert [label.tagFQN.root for label in source.get_tag_labels("table")] == ["PII.Sensitive"]


def test_custom_case_and_multiple_values_remain_distinct(source):
    for name in ("Mixed", "MIXED"):
        tag = source.define_tag(
            classification_name="Custom", tag_name=name, classification_description="", tag_description=""
        )
        source.attach_tag(entity_fqn="svc.db.schema.table", tag=tag)
    assert [label.tagFQN.root for label in source.get_tag_by_fqn("svc.db.schema.table")] == [
        "Custom.Mixed",
        "Custom.MIXED",
    ]
    assert len(list(source.tags_registry.drain())) == 2


def test_early_schema_attachments_have_independent_lifetimes(source):
    tag = TagDefinition("Class", "Value", "", "")
    with source._node_scope(source.topology.database, "db"):
        for schema in ("a", "b", "filtered"):
            source.attach_tag(entity_fqn=f"svc.db.{schema}", tag=tag)
        with source._node_scope(source.topology.databaseSchema, "a"):
            assert source.get_tag_by_fqn("svc.db.a")
        assert source.get_tag_by_fqn("svc.db.a") is None
        assert [label.tagFQN.root for label in source.get_tag_by_fqn("svc.db.b")] == ["Class.Value"]
    assert source.get_tag_by_fqn("svc.db.b") is None
    assert source.get_tag_by_fqn("svc.db.filtered") is None
    assert source.tags_registry.stats()["active_scopes"] == 0


def test_scope_owner_handles_quoted_fqn_components(source):
    source.context.get().upsert("database_service", "my.service")
    tag = TagDefinition("Class", "Value", "", "")
    entity = '"my.service"."my.database"."my.schema"."my.table"'
    source.attach_tag(entity_fqn=entity, tag=tag)
    assert [label.tagFQN.root for label in source.get_tag_by_fqn(entity)] == ["Class.Value"]
    source.tags_registry.clear_scope('"my.service"."my.database"."my.schema"')
    assert source.get_tag_by_fqn(entity) is None


@pytest.mark.parametrize("entity", ["svc", "other.db.schema.table", "svc_extra.db.schema.table"])
def test_scope_rejects_entities_outside_source_service(source, entity):
    with pytest.raises(ValueError, match="source service"):
        source.attach_tag(entity_fqn=entity, tag=TagDefinition("Class", "Value", "", ""))
    assert source.tags_registry.stats()["active_scopes"] == 0


@pytest.fixture(params=[MysqlSource, MongodbSource, GlueSource, DatalakeSource])
def default_source(request):
    instance = object.__new__(request.param)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (("database_service", "svc"), ("database", "db"), ("database_schema", "schema")):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.side_effect = AssertionError("Empty tags must not query search")
    instance.metadata.get_by_name.side_effect = AssertionError("Label lookup must not access the server")
    return instance


@pytest.mark.parametrize("include_tags", [True, False])
def test_default_sources_emit_no_tags_and_keep_empty_lookups(default_source, include_tags):
    source = default_source
    source.source_config.includeTags = include_tags
    with (
        source._node_scope(source.topology.database, "db"),
        source._node_scope(source.topology.databaseSchema, "schema"),
    ):
        for node, item in (
            (source.topology.database, "db"),
            (source.topology.databaseSchema, "schema"),
            (source.topology.table, ("table", "Regular")),
        ):
            assert list(source._process_stage(node.stages[0], item)) == []
        assert source.get_database_tag_labels("db") is None
        assert source.get_schema_tag_labels("schema") is None
        assert source.get_tag_labels("table") is None
        assert source.get_column_tag_labels("table", {"name": "column"}) is None
    assert source.tags_registry.stats()["active_scopes"] == 0
    assert source.tags_registry.stats()["pending"] == 0
    assert getattr(source.context.get(), "tags", None) is None


@pytest.mark.parametrize("level", ["database", "schema", "table"])
def test_default_stages_emit_registered_definitions_and_preserve_labels(default_source, level):
    source = default_source
    source.metadata.es_search_from_fqn.side_effect = None
    source.metadata.es_search_from_fqn.return_value = []
    node, item, entity_fqn = {
        "database": (source.topology.database, "db", "svc.db"),
        "schema": (source.topology.databaseSchema, "schema", "svc.db.schema"),
        "table": (source.topology.table, ("table", "Regular"), "svc.db.schema.table"),
    }[level]
    with (
        source._node_scope(source.topology.database, "db"),
        source._node_scope(source.topology.databaseSchema, "schema"),
    ):
        tag = source.define_tag(
            classification_name="Class", tag_name="Value", classification_description="", tag_description=""
        )
        source.attach_tag(entity_fqn=entity_fqn, tag=tag)
        records = list(source._process_stage(node.stages[0], item))
        assert len(records) == 1
        assert records[0].right.tag_request.name.root == "Value"
        assert records[0].right.fqn is None
        assert [label.tagFQN.root for label in source.get_tag_by_fqn(entity_fqn)] == ["Class.Value"]
        assert source.get_tag_by_fqn("svc.db.schema.other") is None
        assert list(source._process_stage(node.stages[0], item)) == []
        assert getattr(source.context.get(), "tags", None) is None
    assert source.get_tag_by_fqn(entity_fqn) is None
    assert source.tags_registry.stats()["active_scopes"] == 0


def test_connector_contexts_keep_independent_thread_settings():
    snowflake_context, postgres_context = SnowflakeSource.context, PostgresSource.context
    original = snowflake_context.threads, postgres_context.threads
    try:
        snowflake_context.set_threads(1)
        postgres_context.set_threads(4)
        assert snowflake_context.threads == 1
        assert postgres_context.threads == 4
    finally:
        snowflake_context.set_threads(original[0])
        postgres_context.set_threads(original[1])
