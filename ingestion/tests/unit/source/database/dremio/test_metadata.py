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
The Dremio metadata source, on a fake REST API
"""

from unittest.mock import patch

import pytest
import requests

from metadata.generated.schema.entity.data.table import DataType, TableType
from metadata.ingestion.source.database.dremio.metadata import to_column

from ._fixtures import dataset, folder  # noqa: TID252

CATALOG = {
    "/catalog": {
        "data": [
            {"containerType": "SPACE", "path": ["reporting"], "id": "space-id"},
            {"containerType": "SOURCE", "path": ["lake"], "id": "lake-id"},
            {"containerType": "HOME", "path": ["@admin"], "id": "home-id"},
        ]
    },
    "/catalog/by-path/reporting": {
        "children": [
            dataset("reporting", "totals", view=True),
            folder("reporting", "reporting"),
            folder("reporting", "deep"),
            folder("reporting", "empty"),
        ]
    },
    "/catalog/by-path/reporting/reporting": {"children": [dataset("reporting", "reporting", "archived", view=True)]},
    "/catalog/by-path/reporting/deep": {"children": [folder("reporting", "deep", "er")]},
    "/catalog/by-path/reporting/deep/er": {"children": [dataset("reporting", "deep", "er", "v", view=True)]},
    "/catalog/by-path/reporting/empty": {"children": []},
}


def schemas_of(source, database: str) -> list[str]:
    source.context.get().database = database
    return list(source.get_database_schema_names())


class TestNames:
    def test_sources_and_spaces_are_the_databases(self, make_source):
        assert list(make_source(CATALOG).get_database_names()) == ["reporting", "lake"]

    def test_a_folder_path_is_one_schema_and_the_root_is_default(self, make_source):
        # ADR:2026-11-18-dremio-schema-name-is-the-folder-path-without-its-space
        assert schemas_of(make_source(CATALOG), "reporting") == ["deep.er", "default", "reporting"]

    def test_the_tables_of_a_schema(self, make_source):
        source = make_source(CATALOG)
        schemas_of(source, "reporting")
        source.context.get().database_schema = "default"

        assert list(source.get_tables_name_and_type()) == [("totals", TableType.View)]

    def test_the_namespace_is_read_once_per_database(self, make_source):
        source = make_source(CATALOG)
        schemas_of(source, "reporting")
        list(source.get_raw_database_schema_names())  # as mark_tables_as_deleted does

        assert source.client.requested.count("/catalog/by-path/reporting") == 1

    def test_a_folder_that_cannot_be_read_is_reported_and_the_others_are_kept(self, make_source):
        source = make_source({**CATALOG, "/catalog/by-path/reporting/deep": requests.ConnectionError("down")})

        assert schemas_of(source, "reporting") == ["default", "reporting"]
        assert source.status.failures[0].name == "reporting/deep"

    def test_cloud_internal_sources_are_skipped(self, make_source):
        source = make_source(
            {**CATALOG, "/catalog/lake-id": {"type": "DCS_CORE_ICEBERG"}, "/catalog/space-id": {"type": "SPACE"}},
            is_cloud=True,
        )

        assert list(source.get_database_names()) == ["reporting"]

    @pytest.mark.parametrize(
        ("source_config", "expected"),
        [
            ({"includeViews": False}, ["archived_table"]),
            ({"includeTables": False}, ["archived"]),
        ],
    )
    def test_the_include_switches_keep_tables_or_views_out(self, make_source, source_config, expected):
        source = make_source(
            {
                **CATALOG,
                "/catalog/by-path/reporting/reporting": {
                    "children": [
                        dataset("reporting", "reporting", "archived", view=True),
                        dataset("reporting", "reporting", "archived_table"),
                    ]
                },
            },
            source_config=source_config,
        )
        schemas_of(source, "reporting")
        source.context.get().database_schema = "reporting"

        assert [name for name, _ in source.get_tables_name_and_type()] == expected

    def test_the_database_filter(self, make_source):
        source = make_source(CATALOG, source_config={"databaseFilterPattern": {"includes": ["^lake$"]}})

        assert list(source.get_database_names()) == ["lake"]


TOTALS = {
    "id": "reporting/totals",
    "sql": "SELECT name FROM lake.customers",
    "fields": [{"name": "name", "type": {"name": "VARCHAR"}}],
}


class TestDeletion:
    """A schema missing because its folder could not be read is not a deleted schema"""

    @pytest.mark.parametrize("failing", ["/catalog/by-path/reporting", "/catalog/by-path/reporting/deep"])
    def test_schemas_are_not_marked_deleted_after_an_incomplete_walk(self, make_source, failing):
        source = make_source({**CATALOG, failing: requests.ConnectionError("down")}, source_config=DELETE_SCHEMAS)
        schemas_of(source, "reporting")

        with patch(DELETE_FROM_SOURCE) as delete_entity_from_source:
            assert list(source.mark_schemas_as_deleted()) == []

        delete_entity_from_source.assert_not_called()

    def test_schemas_are_marked_deleted_after_a_complete_walk(self, make_source):
        source = make_source(CATALOG, source_config=DELETE_SCHEMAS)
        schemas_of(source, "reporting")

        with patch(DELETE_FROM_SOURCE, return_value=iter(())) as delete_entity_from_source:
            list(source.mark_schemas_as_deleted())

        delete_entity_from_source.assert_called_once()

    def test_a_complete_walk_of_the_next_database_deletes_again(self, make_source):
        source = make_source(
            {
                **CATALOG,
                "/catalog/by-path/reporting/deep": requests.ConnectionError("down"),
                "/catalog/by-path/lake": {"children": [dataset("lake", "customers")]},
            },
            source_config=DELETE_SCHEMAS,
        )
        schemas_of(source, "reporting")
        schemas_of(source, "lake")

        with patch(DELETE_FROM_SOURCE, return_value=iter(())) as delete_entity_from_source:
            list(source.mark_schemas_as_deleted())

        delete_entity_from_source.assert_called_once()


DELETE_SCHEMAS = {"markDeletedSchemas": True}
DELETE_FROM_SOURCE = "metadata.ingestion.source.database.database_service.delete_entity_from_source"


class TestTable:
    def test_a_view_with_its_wiki_and_tags(self, make_source):
        source = make_source(
            {
                **CATALOG,
                "/catalog/reporting/totals": TOTALS,
                "/catalog/reporting/totals/collaboration/wiki": {"text": "Totals per customer"},
                "/catalog/reporting/totals/collaboration/tag": {"tags": ["gold", "gold", 3]},
            },
            source_config={"includeTags": True},
        )
        schemas_of(source, "reporting")
        source.context.get().database_schema = "default"
        list(source.yield_tag("default"))

        (either,) = source.yield_table(("totals", TableType.View))

        table = either.right
        assert table.databaseSchema.root == "svc.reporting.default"
        assert table.schemaDefinition.root == 'CREATE VIEW "totals" AS SELECT name FROM lake.customers'
        assert table.description.root == "Totals per customer"
        assert [tag.tagFQN.root for tag in table.tags] == ["DremioTags.gold"]

    def test_a_dataset_that_cannot_be_read_is_an_error(self, make_source):
        source = make_source(CATALOG)
        schemas_of(source, "reporting")
        source.context.get().database_schema = "default"

        (either,) = source.yield_table(("totals", TableType.View))

        assert either.right is None
        assert either.left.name == "totals"

    def test_the_wiki_of_a_folder_describes_its_schema(self, make_source):
        source = make_source({**CATALOG, "/catalog/reporting/deep/er/collaboration/wiki": {"text": "Deep"}})
        schemas_of(source, "reporting")
        source.context.get().database = "reporting"

        (either,) = source.yield_database_schema("deep.er")

        assert either.right.description.root == "Deep"


class TestColumns:
    def test_a_struct_keeps_the_names_of_its_fields(self):
        column = to_column(
            {
                "name": "address",
                "type": {
                    "name": "STRUCT",
                    "subSchema": [
                        {"name": "Street Name", "type": {"name": "VARCHAR"}},
                        {
                            "name": "geo",
                            "type": {"name": "STRUCT", "subSchema": [{"name": "lat", "type": {"name": "DOUBLE"}}]},
                        },
                    ],
                },
            },
            1,
        )

        assert column.dataType == DataType.STRUCT
        assert [child.name.root for child in column.children] == ["Street Name", "geo"]
        assert column.children[1].children[0].dataType == DataType.DOUBLE

    def test_a_list_is_an_array_of_its_element(self):
        column = to_column(
            {
                "name": "items",
                "type": {
                    "name": "LIST",
                    "subSchema": [
                        {"type": {"name": "STRUCT", "subSchema": [{"name": "sku", "type": {"name": "INTEGER"}}]}}
                    ],
                },
            }
        )

        assert column.dataType == DataType.ARRAY
        assert column.arrayDataType == DataType.STRUCT
        assert [child.name.root for child in column.children] == ["sku"]

    def test_lengths_and_precision(self):
        varchar = to_column({"name": "s", "type": {"name": "VARCHAR"}})
        decimal = to_column({"name": "d", "type": {"name": "DECIMAL", "precision": 10, "scale": 2}})

        assert varchar.dataLength == 65535
        assert (decimal.precision, decimal.scale) == (10, 2)
