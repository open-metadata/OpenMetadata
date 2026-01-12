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
Unit tests for Snowflake ordinal position feature
"""

from unittest import TestCase
from unittest.mock import Mock, patch

from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from metadata.ingestion.source.database.snowflake.utils import get_schema_columns


class SnowflakeOrdinalPositionTest(TestCase):
    """
    Unit tests for Snowflake ordinal position in column details
    """

    def setUp(self):
        self.dialect = SnowflakeDialect()
        self.mock_connection = Mock()

        self.dialect.normalize_name = lambda x: x
        self.dialect.denormalize_name = lambda x: x

    def test_get_schema_columns_includes_ordinal_position(self):
        """Test that get_schema_columns returns ordinal_position for each column"""
        mock_result = [
            (
                "TEST_TABLE",
                "ID",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "NO",
                "Primary key column",
                None,
                None,
                1,
            ),
            (
                "TEST_TABLE",
                "NAME",
                "VARCHAR",
                255,
                None,
                None,
                "YES",
                None,
                "NO",
                "Name column",
                None,
                None,
                2,
            ),
            (
                "TEST_TABLE",
                "CREATED_AT",
                "TIMESTAMP_NTZ",
                None,
                None,
                None,
                "NO",
                "CURRENT_TIMESTAMP()",
                "NO",
                "Creation timestamp",
                None,
                None,
                3,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={"TEST_TABLE": {"constrained_columns": ["ID"]}},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertIsNotNone(result)
        self.assertIn("TEST_TABLE", result)
        self.assertEqual(len(result["TEST_TABLE"]), 3)

        self.assertEqual(result["TEST_TABLE"][0]["ordinal_position"], 1)
        self.assertEqual(result["TEST_TABLE"][0]["name"], "ID")

        self.assertEqual(result["TEST_TABLE"][1]["ordinal_position"], 2)
        self.assertEqual(result["TEST_TABLE"][1]["name"], "NAME")

        self.assertEqual(result["TEST_TABLE"][2]["ordinal_position"], 3)
        self.assertEqual(result["TEST_TABLE"][2]["name"], "CREATED_AT")

    def test_ordinal_position_ordering(self):
        """Test that columns maintain correct ordinal position order"""
        mock_result = [
            (
                "TABLE_A",
                "COL_Z",
                "VARCHAR",
                100,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                3,
            ),
            (
                "TABLE_A",
                "COL_A",
                "NUMBER",
                None,
                10,
                2,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
            (
                "TABLE_A",
                "COL_M",
                "DATE",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                2,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(result["TABLE_A"][0]["name"], "COL_Z")
        self.assertEqual(result["TABLE_A"][0]["ordinal_position"], 3)

        self.assertEqual(result["TABLE_A"][1]["name"], "COL_A")
        self.assertEqual(result["TABLE_A"][1]["ordinal_position"], 1)

        self.assertEqual(result["TABLE_A"][2]["name"], "COL_M")
        self.assertEqual(result["TABLE_A"][2]["ordinal_position"], 2)

    def test_ordinal_position_with_multiple_tables(self):
        """Test ordinal position handling across multiple tables"""
        mock_result = [
            (
                "TABLE_1",
                "COL_1",
                "NUMBER",
                None,
                10,
                0,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
            (
                "TABLE_1",
                "COL_2",
                "VARCHAR",
                50,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                2,
            ),
            (
                "TABLE_2",
                "ID",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
            (
                "TABLE_2",
                "DESC",
                "TEXT",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                2,
            ),
            (
                "TABLE_2",
                "STATUS",
                "VARCHAR",
                20,
                None,
                None,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                3,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(len(result["TABLE_1"]), 2)
        self.assertEqual(result["TABLE_1"][0]["ordinal_position"], 1)
        self.assertEqual(result["TABLE_1"][1]["ordinal_position"], 2)

        self.assertEqual(len(result["TABLE_2"]), 3)
        self.assertEqual(result["TABLE_2"][0]["ordinal_position"], 1)
        self.assertEqual(result["TABLE_2"][1]["ordinal_position"], 2)
        self.assertEqual(result["TABLE_2"][2]["ordinal_position"], 3)

    def test_ordinal_position_with_identity_columns(self):
        """Test ordinal position with identity columns"""
        mock_result = [
            (
                "TEST_TABLE",
                "ID",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "YES",
                "Identity column",
                1,
                1,
                1,
            ),
            (
                "TEST_TABLE",
                "DATA",
                "VARCHAR",
                255,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                2,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={"TEST_TABLE": {"constrained_columns": ["ID"]}},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(result["TEST_TABLE"][0]["ordinal_position"], 1)
        self.assertEqual(result["TEST_TABLE"][0]["autoincrement"], True)
        self.assertIsNotNone(result["TEST_TABLE"][0]["identity"])

        self.assertEqual(result["TEST_TABLE"][1]["ordinal_position"], 2)
        self.assertEqual(result["TEST_TABLE"][1]["autoincrement"], False)

    def test_ordinal_position_with_clustering_columns(self):
        """Test that clustering columns are skipped but ordinal positions are preserved"""
        mock_result = [
            (
                "TEST_TABLE",
                "ID",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
            (
                "TEST_TABLE",
                "sys_clustering_column_1",
                "VARIANT",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                2,
            ),
            (
                "TEST_TABLE",
                "NAME",
                "VARCHAR",
                255,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                3,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(len(result["TEST_TABLE"]), 2)
        self.assertEqual(result["TEST_TABLE"][0]["name"], "ID")
        self.assertEqual(result["TEST_TABLE"][0]["ordinal_position"], 1)

        self.assertEqual(result["TEST_TABLE"][1]["name"], "NAME")
        self.assertEqual(result["TEST_TABLE"][1]["ordinal_position"], 3)

    def test_ordinal_position_with_all_data_types(self):
        """Test ordinal position with various Snowflake data types"""
        mock_result = [
            (
                "TEST_TABLE",
                "NUM_COL",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
            (
                "TEST_TABLE",
                "FLOAT_COL",
                "FLOAT",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                2,
            ),
            (
                "TEST_TABLE",
                "VARCHAR_COL",
                "VARCHAR",
                100,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                3,
            ),
            (
                "TEST_TABLE",
                "DATE_COL",
                "DATE",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                4,
            ),
            (
                "TEST_TABLE",
                "TIMESTAMP_COL",
                "TIMESTAMP_NTZ",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                5,
            ),
            (
                "TEST_TABLE",
                "BOOLEAN_COL",
                "BOOLEAN",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                6,
            ),
            (
                "TEST_TABLE",
                "VARIANT_COL",
                "VARIANT",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                7,
            ),
            (
                "TEST_TABLE",
                "ARRAY_COL",
                "ARRAY",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                8,
            ),
            (
                "TEST_TABLE",
                "OBJECT_COL",
                "OBJECT",
                None,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                9,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(len(result["TEST_TABLE"]), 9)
        for idx, column in enumerate(result["TEST_TABLE"], start=1):
            self.assertEqual(column["ordinal_position"], idx)

    def test_ordinal_position_with_primary_key(self):
        """Test that ordinal position is correctly set for primary key columns"""
        mock_result = [
            (
                "TEST_TABLE",
                "OTHER_COL",
                "VARCHAR",
                50,
                None,
                None,
                "YES",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
            (
                "TEST_TABLE",
                "PK_COL",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "NO",
                "Primary key",
                None,
                None,
                2,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={"TEST_TABLE": {"constrained_columns": ["PK_COL"]}},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(result["TEST_TABLE"][0]["name"], "OTHER_COL")
        self.assertEqual(result["TEST_TABLE"][0]["ordinal_position"], 1)
        self.assertEqual(result["TEST_TABLE"][0]["primary_key"], False)

        self.assertEqual(result["TEST_TABLE"][1]["name"], "PK_COL")
        self.assertEqual(result["TEST_TABLE"][1]["ordinal_position"], 2)
        self.assertEqual(result["TEST_TABLE"][1]["primary_key"], True)

    def test_ordinal_position_column_present_in_dict(self):
        """Test that ordinal_position key is present in column dictionary"""
        mock_result = [
            (
                "TEST_TABLE",
                "COL1",
                "NUMBER",
                None,
                10,
                0,
                "NO",
                None,
                "NO",
                None,
                None,
                None,
                1,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        column = result["TEST_TABLE"][0]
        self.assertIn("ordinal_position", column)
        self.assertIsInstance(column["ordinal_position"], int)
        self.assertEqual(column["ordinal_position"], 1)

    def test_ordinal_position_with_empty_result(self):
        """Test handling when no columns are returned"""
        mock_result = []

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(result, {})

    def test_ordinal_position_system_data_type_mapping(self):
        """Test that ordinal position works correctly with system_data_type field"""
        mock_result = [
            (
                "TEST_TABLE",
                "ID",
                "NUMBER",
                None,
                38,
                0,
                "NO",
                None,
                "NO",
                "ID column",
                None,
                None,
                1,
            ),
            (
                "TEST_TABLE",
                "PRICE",
                "NUMBER",
                None,
                10,
                2,
                "YES",
                None,
                "NO",
                "Price column",
                None,
                None,
                2,
            ),
        ]

        mock_execute_result = Mock()
        mock_execute_result.__iter__ = Mock(return_value=iter(mock_result))
        self.mock_connection.execute = Mock(return_value=mock_execute_result)

        with patch.object(
            self.dialect,
            "_current_database_schema",
            return_value=("TEST_DB", "TEST_SCHEMA"),
        ):
            with patch.object(
                self.dialect,
                "_get_schema_primary_keys",
                return_value={},
            ):
                result = get_schema_columns(
                    self.dialect, self.mock_connection, "TEST_SCHEMA"
                )

        self.assertEqual(result["TEST_TABLE"][0]["ordinal_position"], 1)
        self.assertEqual(result["TEST_TABLE"][0]["system_data_type"], "NUMBER(38,0)")

        self.assertEqual(result["TEST_TABLE"][1]["ordinal_position"], 2)
        self.assertEqual(result["TEST_TABLE"][1]["system_data_type"], "NUMBER(10,2)")
