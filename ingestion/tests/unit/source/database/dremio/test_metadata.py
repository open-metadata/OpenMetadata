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

"""
Unit tests for how the Dremio source maps spaces, folders and tables
"""

from unittest.mock import MagicMock

import pytest

from metadata.ingestion.source.database.dremio.metadata import DremioSource
from metadata.ingestion.source.database.dremio.queries import DREMIO_GET_DATABASES, DREMIO_GET_SCHEMAS


def dremio_source(database="polaris") -> DremioSource:
    source = DremioSource.__new__(DremioSource)
    source.database = database
    return source


class TestSchemaNames:
    @pytest.mark.parametrize(
        "dremio_schema,expected",
        [
            ("polaris.demo", "demo"),
            ("polaris.demo.sub", "demo.sub"),
            ("polaris", "polaris"),  # the objects at the root of the namespace
            ("polaris2.demo", "polaris2.demo"),  # another namespace that starts the same
        ],
    )
    def test_the_namespace_is_removed_from_the_schema(self, dremio_schema, expected):
        assert dremio_source()._remove_database_from_schema_name(dremio_schema) == expected

    @pytest.mark.parametrize(
        "schema,expected",
        [
            ("demo", "polaris.demo"),
            ("demo.sub", "polaris.demo.sub"),
            ("polaris", "polaris"),
            ("", "polaris"),
            (None, "polaris"),
            ("  ", "polaris"),
        ],
    )
    def test_the_namespace_is_added_back_to_the_schema(self, schema, expected):
        assert dremio_source()._add_database_to_schema_name(schema) == expected

    def test_names_are_left_alone_without_a_namespace(self):
        source = dremio_source(database=None)

        assert source._add_database_to_schema_name("demo") == "demo"
        assert source._remove_database_from_schema_name("polaris.demo") == "polaris.demo"


class TestSchemas:
    def test_the_objects_at_the_root_of_a_namespace_have_a_schema(self):
        source = dremio_source("om_demo")
        source._execute_database_query = MagicMock(return_value=["om_demo.reports", "om_demo"])

        assert list(source.get_raw_database_schema_names()) == ["reports", "om_demo"]

    def test_the_query_looks_for_the_namespace_itself_and_its_folders(self):
        assert "STARTS_WITH(SCHEMA_NAME, '{database_name}.')" in DREMIO_GET_SCHEMAS
        assert "UNION" in DREMIO_GET_SCHEMAS
        assert "TABLE_SCHEMA = '{database_name}'" in DREMIO_GET_SCHEMAS

    def test_an_underscore_is_not_a_wildcard(self):
        # `sulo_catalog` would match `suloXcatalog` with LIKE
        assert "LIKE" not in DREMIO_GET_SCHEMAS

    def test_a_quote_in_a_namespace_cannot_break_the_query(self):
        source = dremio_source("o'brien")
        source._execute_database_query = MagicMock(return_value=[])

        list(source.get_raw_database_schema_names())

        assert "TABLE_SCHEMA = 'o''brien'" in source._execute_database_query.call_args.args[0]


class TestDatabaseQuery:
    def test_the_system_catalogs_are_not_databases(self):
        assert "UPPER(SCHEMA_NAME) NOT IN ('INFORMATION_SCHEMA', 'SYS')" in DREMIO_GET_DATABASES

    def test_folders_and_internal_spaces_are_still_left_out(self):
        assert "NOT LIKE '%.%'" in DREMIO_GET_DATABASES
        assert "STARTS_WITH(SCHEMA_NAME, '@')" in DREMIO_GET_DATABASES
        assert "STARTS_WITH(SCHEMA_NAME, '$')" in DREMIO_GET_DATABASES


class TestTableQueries:
    def test_the_tables_of_the_root_are_read_from_the_namespace(self):
        source = dremio_source("om_demo")
        source._execute_database_query = MagicMock(return_value=["sales_v"])

        views = list(source.query_view_names_and_types("om_demo"))

        assert [view.name for view in views] == ["sales_v"]
        assert "TABLE_SCHEMA  = 'om_demo'" in source._execute_database_query.call_args.args[0]

    def test_the_tables_of_a_folder_are_read_with_the_full_path(self):
        source = dremio_source("polaris")
        source._execute_database_query = MagicMock(return_value=[])

        list(source.query_table_names_and_types("demo"))

        assert "TABLE_SCHEMA  = 'polaris.demo'" in source._execute_database_query.call_args.args[0]
