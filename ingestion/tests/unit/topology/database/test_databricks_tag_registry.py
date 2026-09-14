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
"""Databricks-family SQL tags through the database registry topology."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, RLock
from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.databricks.metadata import DatabricksSource
from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource


@pytest.fixture(params=[DatabricksSource, UnitycatalogSource], ids=["databricks", "unitycatalog"])
def source(request):
    instance = object.__new__(request.param)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (("database_service", "svc"), ("database", "catalog"), ("database_schema", "schema")):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()

    def search(*, entity_type, **kwargs):
        assert entity_type in (Classification, Tag), "Entity attachment FQNs must not depend on search"
        return []

    instance.metadata.es_search_from_fqn.side_effect = search
    instance.metadata.get_by_name.side_effect = AssertionError("Label lookup must not access the server")
    instance.engine = MagicMock()
    instance._connection_map = {}
    instance._sql_connection_map = {}
    instance._state_lock = RLock()
    instance.catalog_tags = {}
    instance.schema_tags = {}
    instance.table_tags = {}
    instance.column_tags = {}
    return instance


def row(key, value, schema="schema", table="table", column="column", catalog="catalog"):
    return SimpleNamespace(
        tag_name=key, tag_value=value, catalog_name=catalog, schema_name=schema, table_name=table, column_name=column
    )


def sql_rows(source, **rows):
    def execute(statement):
        query = str(statement)
        for kind in ("catalog", "schema", "table", "column"):
            if f"information_schema.{kind}_tags" in query:
                result = rows.get(kind, [])
                if isinstance(result, Exception):
                    raise result
                return [
                    item
                    for item in result
                    if "WHERE schema_name" not in query or f"WHERE schema_name = '{item.schema_name}'" in query
                ]
        raise AssertionError(f"Unexpected SQL: {query}")

    source.engine.connect.return_value.execute.side_effect = execute
    if isinstance(source, DatabricksSource):
        source.populate_tags_cache(source.context.get().database)


def database_stage(source):
    return list(source._process_stage(source.topology.database.stages[0], source.context.get().database))


def schema_stage(source, name="schema"):
    source.context.get().upsert("database_schema", name)
    return list(source._process_stage(source.topology.databaseSchema.stages[0], name))


def table_stage(source, name="table"):
    return list(source._process_stage(source.topology.table.stages[0], (name, TableType.Regular)))


def fqns(labels):
    return [label.tagFQN.root for label in labels or []]


def test_four_levels_share_definitions_without_sharing_attachments(source):
    sql_rows(
        source,
        catalog=[row("Env", "Shared")],
        schema=[row("Env", "Shared")],
        table=[row("Env", "Shared"), row("Case", "Mixed"), row("Case", "MIXED")],
        column=[row("PII", "Local")],
    )
    with source._node_scope(source.topology.database, "catalog"):
        records = database_stage(source)
        with source._node_scope(source.topology.databaseSchema, "schema"):
            records += schema_stage(source) + table_stage(source)
            assert fqns(source.get_database_tag_labels("catalog")) == ["Env.Shared"]
            assert fqns(source.get_schema_tag_labels("schema")) == ["Env.Shared"]
            assert fqns(source.get_tag_labels("table")) == ["Env.Shared", "Case.Mixed", "Case.MIXED"]
            assert fqns(source.get_column_tag_labels("table", {"name": "column"})) == ["PII.Local"]
            assert source.get_tag_labels("untagged") is None
            assert source.get_column_tag_labels("table", {"name": "other"}) is None
        assert source.get_tag_labels("table") is None
        assert fqns(source.get_database_tag_labels("catalog")) == ["Env.Shared"]
    assert source.tags_registry.stats()["active_scopes"] == 0
    assert not any(record.left for record in records)
    assert len(records) == 4
    assert all(record.right.fqn is None for record in records)
    assert getattr(source.context.get(), "tags", None) is None


@pytest.mark.parametrize("level", ["catalog", "schema", "table", "column"])
def test_system_tags_resolve_at_every_level(source, level):
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
    sql_rows(source, **{level: [row("pii", "sensitive")]})
    records = database_stage(source) + schema_stage(source) + table_stage(source)
    assert len(records) == 1
    assert records[0].right.classification_request.name.root == "PII"
    assert records[0].right.tag_request.name.root == "Sensitive"
    assert records[0].right.tag_request.description.root == "System tag"
    target = {
        "catalog": "svc.catalog",
        "schema": "svc.catalog.schema",
        "table": "svc.catalog.schema.table",
        "column": "svc.catalog.schema.table.column",
    }[level]
    assert fqns(source.get_tag_by_fqn(target)) == ["PII.Sensitive"]


def test_invalid_tag_does_not_discard_later_tags_or_other_queries(source):
    sql_rows(source, table=[row("Class", 'bad"name'), row("Class", "Valid")], column=[row("ColumnClass", "Valid")])
    records = database_stage(source) + schema_stage(source) + table_stage(source)
    assert len([record for record in records if record.left]) == 1
    assert len([record for record in records if record.right]) == 2
    assert fqns(source.get_tag_labels("table")) == ["Class.Valid"]
    assert fqns(source.get_column_tag_labels("table", {"name": "column"})) == ["ColumnClass.Valid"]


def test_failed_queries_leave_other_levels_ingestable(source):
    sql_rows(
        source,
        catalog=RuntimeError("denied"),
        table=RuntimeError("denied"),
        schema=[row("Env", "Prod")],
        column=[row("PII", "Local")],
    )
    records = database_stage(source) + schema_stage(source) + table_stage(source)
    assert len(records) == 2
    assert fqns(source.get_schema_tag_labels("schema")) == ["Env.Prod"]
    assert fqns(source.get_column_tag_labels("table", {"name": "column"})) == ["PII.Local"]


def test_disabled_tags_do_not_query_or_register(source):
    source.source_config.includeTags = False
    source.engine.connect.side_effect = AssertionError("Tags disabled must not access SQL")
    if isinstance(source, DatabricksSource):
        source.populate_tags_cache("catalog")
    assert database_stage(source) + schema_stage(source) + table_stage(source) == []
    assert source.tags_registry.stats()["active_scopes"] == 0
    assert source.get_tag_labels("table") is None


def test_schema_cleanup_preserves_later_and_prefetched_schema_tags(source):
    sql_rows(
        source,
        schema=[
            row("Env", "First", schema="first"),
            row("Env", "Second", schema="second"),
            row("Env", "Filtered", schema="filtered"),
        ],
        table=[row("Team", "One", schema="first"), row("Team", "Two", schema="second")],
    )
    with source._node_scope(source.topology.database, "catalog"):
        database_stage(source)
        for name, schema_tag, table_tag in [("first", "Env.First", "Team.One"), ("second", "Env.Second", "Team.Two")]:
            with source._node_scope(source.topology.databaseSchema, name):
                schema_stage(source, name)
                table_stage(source)
                assert fqns(source.get_schema_tag_labels(name)) == [schema_tag]
                assert fqns(source.get_tag_labels("table")) == [table_tag]
            assert source.get_schema_tag_labels(name) is None
            assert source.get_tag_labels("table") is None
    assert source.get_schema_tag_labels("filtered") is None
    assert source.tags_registry.stats()["active_scopes"] == 0


def test_quoted_resource_names_use_source_identity(source):
    source.context.get().upsert("database_service", "my.service")
    source.context.get().upsert("database", "my.catalog")
    sql_rows(
        source,
        table=[row("Env", "Prod", catalog="my.catalog", schema="my.schema", table="my.table")],
        column=[row("PII", "Local", catalog="my.catalog", schema="my.schema", table="my.table", column="my.column")],
    )
    records = database_stage(source) + schema_stage(source, "my.schema") + table_stage(source, "my.table")
    assert len(records) == 2
    assert fqns(source.get_tag_labels("my.table")) == ["Env.Prod"]
    assert fqns(source.get_column_tag_labels("my.table", {"name": "my.column"})) == ["PII.Local"]


def test_concurrent_schemas_keep_labels_separate(source):
    sql_rows(
        source,
        schema=[row("Env", "One", schema="first"), row("Env", "Two", schema="second")],
        table=[row("Team", "One", schema="first"), row("Team", "Two", schema="second")],
    )
    ready = Barrier(2, timeout=10)

    def process_schema(name, expected):
        source.context.copy_from(source.context.main_thread)
        source.context.get().upsert("database_service", "svc")
        source.context.get().upsert("database", "catalog")
        with source._node_scope(source.topology.databaseSchema, name):
            records = schema_stage(source, name) + table_stage(source)
            assert not any(record.left for record in records)
            ready.wait()
            assert fqns(source.get_schema_tag_labels(name)) == [f"Env.{expected}"]
            assert fqns(source.get_tag_labels("table")) == [f"Team.{expected}"]
        assert source.get_tag_labels("table") is None
        source.context.pop()

    with source._node_scope(source.topology.database, "catalog"):
        database_stage(source)
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(process_schema, "first", "One"), pool.submit(process_schema, "second", "Two")]
            for future in futures:
                future.result(timeout=15)
    assert source.tags_registry.stats()["active_scopes"] == 0
