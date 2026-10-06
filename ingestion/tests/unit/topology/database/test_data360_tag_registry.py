#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Data 360 tags through registry topology stages and entity requests."""

from collections.abc import Iterable
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from tenacity import wait_none

from metadata.domain.tags import TagCanonicalizer
from metadata.generated.schema.entity.data.table import Table, TableType
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import DatabaseServiceMetadataPipeline
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.models import Either
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.database.data360.constant import Constant
from metadata.ingestion.source.database.data360.metadata import Data360Source


@pytest.fixture
def source() -> Data360Source:
    instance = object.__new__(Data360Source)
    instance.source_config = DatabaseServiceMetadataPipeline(includeTags=True)
    instance.context = TopologyContextManager(instance.topology)
    for key, value in (
        ("database_service", "demo_service"),
        ("database", "demo_db"),
        ("database_schema", Constant.DATA_LAKE_OBJECTS),
    ):
        instance.context.get().upsert(key, value)
    instance.metadata = MagicMock()
    instance.metadata.es_search_from_fqn.return_value = []
    instance.metadata.get_by_name.side_effect = AssertionError("Tag labels must not be fetched from the server")
    instance.client = MagicMock()
    instance.client.restful.return_value = {"expression": "SELECT COUNT(*)", "description": "Demo insight"}
    instance.dataspace_map = {"demo_db": {"status": "Active"}}
    instance.table_map = {}
    instance.database_source_state = set()
    return instance


def field(name: str, field_type: str | None = None) -> dict[str, Any]:
    return {"name": name, "displayName": name, "type": "TEXT", "businessType": "text", "fieldType": field_type}


def cache_table(source: Any, name: str = "my_table", calculated: bool = False) -> dict[str, Any]:
    table: dict[str, Any] = (
        {"dimensions": [field("my_dimension")], "measures": [field("my_measure")]}
        if calculated
        else {"category": "Profile", "fields": [field("my_dimension", "Dimension"), field("my_measure", "Measure")]}
    )
    table_fqn = source._build_fqn(
        Table,
        service_name=source._service_name,
        database_name=source._database_name,
        schema_name=source._schema_name,
        table_name=name,
    )
    source.table_map[table_fqn] = table
    return table


def database_stage(source: Any, name: str = "demo_db"):
    return list(source._process_stage(source.topology.database.stages[0], name))


def table_stage(source: Any, name: str = "my_table", table_type: TableType = TableType.Regular):
    return list(source._process_stage(source.topology.table.stages[0], (name, table_type)))


def definitions(records: Iterable[Any]):
    records = list(records)
    assert all(record.left is None for record in records)
    return [record.right.tag_request.name.root for record in records]


def request(records: Iterable[Either]) -> Any:
    records = list(records)
    assert len(records) == 1
    assert records[0].left is None
    assert records[0].right is not None
    return records[0].right


def labels(tags: list[TagLabel] | None) -> list[str]:
    return [tag.tagFQN.root for tag in tags or []]


@pytest.mark.parametrize("schema", [Constant.DATA_LAKE_OBJECTS, Constant.DATA_MODEL_OBJECTS])
def test_requests_keep_database_table_and_column_tag_scopes(source: Any, schema: str):
    source.context.get().upsert("database_schema", schema)
    cache_table(source)
    assert definitions(database_stage(source)) == ["Active"]
    assert set(definitions(table_stage(source))) == {"Profile", "Dimension", "Measure"}

    database = request(source.yield_database("demo_db"))
    database_schema = request(source.yield_database_schema(schema))
    table = request(source.yield_table(("my_table", TableType.Regular)))
    assert labels(database.tags) == ["Data360.Active"]
    assert database_schema.database.root == "demo_service.demo_db"
    assert not database_schema.tags
    assert labels(table.tags) == ["Data360.Profile"]
    assert [labels(column.tags) for column in table.columns] == [["Data360.Dimension"], ["Data360.Measure"]]
    assert source.get_schema_tag_labels(schema) is None
    assert source.get_tag_labels("other_table") is None
    assert source.get_column_tag_labels("my_table", {"name": "other_column"}) is None
    for tag in [*database.tags, *table.tags, *table.columns[0].tags]:
        assert (tag.labelType.value, tag.state.value, tag.source.value) == ("Automated", "Suggested", "Classification")


def test_shared_definitions_are_published_once_and_labels_follow_scope_cleanup(source: Any):
    cache_table(source)
    cache_table(source, "other_table")
    assert definitions(database_stage(source)) == ["Active"]
    assert set(definitions(table_stage(source))) == {"Profile", "Dimension", "Measure"}
    assert definitions(table_stage(source, "other_table")) == []
    assert labels(request(source.yield_table(("other_table", TableType.Regular))).tags) == ["Data360.Profile"]

    list(source.clear_schema_tag_scope())
    assert source.get_tag_labels("my_table") is None
    assert source.get_column_tag_labels("other_table", {"name": "my_dimension"}) is None
    assert labels(request(source.yield_database("demo_db")).tags) == ["Data360.Active"]
    list(source.clear_database_tag_scope())
    assert source.tags_registry.stats()["live_entities"] == 0

    source.context.get().upsert("database", "other_db")
    source.dataspace_map["other_db"] = {"status": "Inactive"}
    cache_table(source)
    assert definitions(database_stage(source, "other_db")) == ["Inactive"]
    assert definitions(table_stage(source)) == []
    assert labels(request(source.yield_database("other_db")).tags) == ["Data360.Inactive"]
    assert labels(request(source.yield_table(("my_table", TableType.Regular))).tags) == ["Data360.Profile"]


def test_calculated_insight_only_ingestion_defines_column_tags(source: Any):
    source.context.get().upsert("database_schema", Constant.CALCULATED_INSIGHTS)
    cache_table(source, calculated=True)["partitionBy"] = "my_dimension"
    assert set(definitions(table_stage(source, table_type=TableType.View))) == {"Dimension", "Measure"}
    table = request(source.yield_table(("my_table", TableType.View)))
    assert labels(table.tags) == []
    assert [labels(column.tags) for column in table.columns] == [["Data360.Dimension"], ["Data360.Measure"]]
    assert table.schemaDefinition.root == "SELECT COUNT(*)"
    assert table.description.root == "Demo insight"
    assert table.tablePartition.columns[0].columnName == "my_dimension"


@pytest.mark.parametrize("calculated", [False, True])
def test_disabled_tags_preserve_entity_requests(source: Any, calculated: bool):
    source.source_config.includeTags = False
    table_type = TableType.View if calculated else TableType.Regular
    if calculated:
        source.context.get().upsert("database_schema", Constant.CALCULATED_INSIGHTS)
    cache_table(source, calculated=calculated)
    assert database_stage(source) == []
    assert table_stage(source, table_type=table_type) == []
    assert list(source.yield_database_tag("demo_db")) == []
    assert list(source.yield_table_tags(("my_table", table_type))) == []
    database = request(source.yield_database("demo_db"))
    table = request(source.yield_table(("my_table", table_type)))
    assert labels(database.tags) == labels(table.tags) == []
    assert len(table.columns) == 2
    assert all(not column.tags for column in table.columns)
    assert source.tags_registry.stats()["pending"] == 0


def test_invalid_tags_do_not_discard_valid_column_tags(source: Any, caplog: pytest.LogCaptureFixture):
    table = cache_table(source)
    table["category"] = 'bad"name'
    table["fields"] = [field("my_column", " "), field("my_dimension", "Dimension")]
    assert set(definitions(table_stage(source))) == {"Dimension", "Measure"}
    assert "Skipped tag 'bad\"name'" in caplog.text
    table_request = request(source.yield_table(("my_table", TableType.Regular)))
    assert labels(table_request.tags) == []
    assert [labels(column.tags) for column in table_request.columns] == [[], ["Data360.Dimension"]]


def test_table_labels_use_source_names_when_search_returns_different_case(source: Any):
    existing_table = SimpleNamespace(
        fullyQualifiedName=SimpleNamespace(root="demo_service.demo_db.Data Lake Objects.MY_TABLE")
    )

    def search(*, entity_type: type, **kwargs: Any):
        return [existing_table] if entity_type is Table else []

    source.metadata.es_search_from_fqn.side_effect = search
    cache_table(source)
    assert set(definitions(table_stage(source))) == {"Profile", "Dimension", "Measure"}
    assert labels(request(source.yield_table(("my_table", TableType.Regular))).tags) == ["Data360.Profile"]


def test_quoted_entity_names_and_custom_field_type_case_are_preserved(source: Any):
    source.context.get().upsert("database", "demo.db")
    source.dataspace_map["demo.db"] = {"status": "Active"}
    table = cache_table(source, "my.table")
    table["fields"] = [field("my.column", "dimension"), field("other_column", "Dimension")]
    assert definitions(database_stage(source, "demo.db")) == ["Active"]
    assert set(definitions(table_stage(source, "my.table"))) == {"Profile", "Measure", "Dimension", "dimension"}
    assert labels(request(source.yield_database("demo.db")).tags) == ["Data360.Active"]
    table_request = request(source.yield_table(("my.table", TableType.Regular)))
    assert labels(table_request.tags) == ["Data360.Profile"]
    assert [labels(column.tags) for column in table_request.columns] == [["Data360.dimension"], ["Data360.Dimension"]]
    list(source.clear_schema_tag_scope())
    assert source.get_tag_labels("my.table") is None
    assert source.get_column_tag_labels("my.table", {"name": "my.column"}) is None
    assert labels(source.get_database_tag_labels("demo.db")) == ["Data360.Active"]


@pytest.mark.parametrize("status", [None, "", " "])
def test_empty_dataspace_status_does_not_create_or_attach_a_tag(source: Any, status: str | None):
    source.dataspace_map["demo_db"] = {"status": status}
    assert database_stage(source) == []
    assert labels(request(source.yield_database("demo_db")).tags) == []


@pytest.mark.parametrize("level", ["database", "table"])
def test_tag_lookup_failures_are_reported_without_attaching_labels(
    source: Any, level: str, monkeypatch: pytest.MonkeyPatch
):
    cache_table(source)
    search_with_retry: Any = TagCanonicalizer._es_search
    monkeypatch.setattr(search_with_retry.retry, "wait", wait_none())
    source.metadata.es_search_from_fqn.side_effect = RuntimeError("Tag search unavailable")
    if level == "database":
        records = database_stage(source)
        assert source.get_database_tag_labels("demo_db") is None
    else:
        records = table_stage(source)
        assert source.get_tag_labels("my_table") is None
        assert source.get_column_tag_labels("my_table", {"name": "my_dimension"}) is None
    assert records
    assert all(record.right is None and "Tag search unavailable" in record.left.error for record in records)
