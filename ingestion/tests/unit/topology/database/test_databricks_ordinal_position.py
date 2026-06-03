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
Unit tests for Databricks ordinal position feature
"""

from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.ingestion.source.database.databricks.metadata import get_columns


class DatabricksOrdinalPositionTest(TestCase):
    """
    Unit tests for Databricks ordinal position in column details
    """

    def setUp(self):
        """Set up test fixtures"""
        self.mock_self = Mock()
        self.mock_connection = Mock()

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_single_column(self, mock_get_column_rows):
        """Test that ordinal position is set for a single column"""
        mock_get_column_rows.return_value = [
            ("id", "int", "ID column"),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "id")
        self.assertEqual(result[0]["ordinal_position"], 0)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_multiple_columns(self, mock_get_column_rows):
        """Test ordinal position with multiple columns in order"""
        mock_get_column_rows.return_value = [
            ("id", "bigint", "Primary key"),
            ("name", "string", "User name"),
            ("email", "string", "Email address"),
            ("created_at", "timestamp", "Creation timestamp"),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "users",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 4)
        self.assertEqual(result[0]["name"], "id")
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[1]["name"], "name")
        self.assertEqual(result[1]["ordinal_position"], 1)
        self.assertEqual(result[2]["name"], "email")
        self.assertEqual(result[2]["ordinal_position"], 2)
        self.assertEqual(result[3]["name"], "created_at")
        self.assertEqual(result[3]["ordinal_position"], 3)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_various_data_types(self, mock_get_column_rows):
        """Test ordinal position with various Databricks data types"""
        mock_get_column_rows.return_value = [
            ("int_col", "int", None),
            ("bigint_col", "bigint", None),
            ("float_col", "float", None),
            ("double_col", "double", None),
            ("string_col", "string", None),
            ("boolean_col", "boolean", None),
            ("date_col", "date", None),
            ("timestamp_col", "timestamp", None),
            ("decimal_col", "decimal(10,2)", None),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 9)
        for idx, column in enumerate(result):
            self.assertEqual(column["ordinal_position"], idx)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_partition_header(self, mock_get_column_rows):
        """Test that ordinal position stops at partition headers"""
        mock_get_column_rows.return_value = [
            ("id", "int", "ID column"),
            ("name", "string", "Name column"),
            ("# Partition Information", "", ""),
            ("partition_col", "string", "Partition column"),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[1]["ordinal_position"], 1)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_complex_types(self, mock_get_column_rows):
        """Test ordinal position with complex data types (array, struct, map)"""
        mock_get_column_rows.return_value = [
            ("simple_col", "string", None),
            ("array_col", "array<int>", None),
            ("struct_col", "struct<field1:string,field2:int>", None),
            ("map_col", "map<string,int>", None),
        ]

        self.mock_connection.execute = Mock()
        mock_result = Mock()
        mock_result.fetchall.return_value = [("data_type", "array<int>")]
        self.mock_connection.execute.return_value = mock_result

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 4)
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[1]["ordinal_position"], 1)
        self.assertEqual(result[2]["ordinal_position"], 2)
        self.assertEqual(result[3]["ordinal_position"], 3)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_empty_result(self, mock_get_column_rows):
        """Test handling of empty column list"""
        mock_get_column_rows.return_value = []

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 0)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_null_comments(self, mock_get_column_rows):
        """Test ordinal position when columns have no comments"""
        mock_get_column_rows.return_value = [
            ("col1", "int", None),
            ("col2", "string", None),
            ("col3", "double", None),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 3)
        for idx, column in enumerate(result):
            self.assertEqual(column["ordinal_position"], idx)
            self.assertIsNone(column["comment"])

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_comments(self, mock_get_column_rows):
        """Test ordinal position when columns have comments"""
        mock_get_column_rows.return_value = [
            ("id", "bigint", "Primary key identifier"),
            ("email", "string", "User email address"),
            ("status", "string", "Account status"),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[0]["comment"], "Primary key identifier")
        self.assertEqual(result[1]["ordinal_position"], 1)
        self.assertEqual(result[1]["comment"], "User email address")
        self.assertEqual(result[2]["ordinal_position"], 2)
        self.assertEqual(result[2]["comment"], "Account status")

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_attribute_exists(self, mock_get_column_rows):
        """Test that ordinal_position key exists in result dictionary"""
        mock_get_column_rows.return_value = [
            ("test_col", "int", None),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 1)
        self.assertIn("ordinal_position", result[0])
        self.assertIsInstance(result[0]["ordinal_position"], int)
        self.assertEqual(result[0]["ordinal_position"], 0)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_zero_indexed(self, mock_get_column_rows):
        """Test that ordinal position is zero-indexed"""
        mock_get_column_rows.return_value = [
            ("first_col", "string", "First column"),
            ("second_col", "int", "Second column"),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[1]["ordinal_position"], 1)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_decimal_precision(self, mock_get_column_rows):
        """Test ordinal position with decimal types having precision and scale"""
        mock_get_column_rows.return_value = [
            ("amount", "decimal(18,2)", "Currency amount"),
            ("rate", "decimal(5,4)", "Interest rate"),
            ("quantity", "decimal(10,3)", "Quantity"),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[0]["system_data_type"], "decimal(18,2)")
        self.assertEqual(result[1]["ordinal_position"], 1)
        self.assertEqual(result[1]["system_data_type"], "decimal(5,4)")
        self.assertEqual(result[2]["ordinal_position"], 2)
        self.assertEqual(result[2]["system_data_type"], "decimal(10,3)")

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_maintains_order(self, mock_get_column_rows):
        """Test that ordinal position maintains the order of columns from Databricks"""
        mock_get_column_rows.return_value = [
            ("z_column", "string", None),
            ("a_column", "int", None),
            ("m_column", "double", None),
            ("b_column", "boolean", None),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 4)
        self.assertEqual(result[0]["name"], "z_column")
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[1]["name"], "a_column")
        self.assertEqual(result[1]["ordinal_position"], 1)
        self.assertEqual(result[2]["name"], "m_column")
        self.assertEqual(result[2]["ordinal_position"], 2)
        self.assertEqual(result[3]["name"], "b_column")
        self.assertEqual(result[3]["ordinal_position"], 3)

    @patch("metadata.ingestion.source.database.databricks.metadata._get_column_rows")
    def test_ordinal_position_with_clustering_header(self, mock_get_column_rows):
        """Test that ordinal position stops at clustering information header"""
        mock_get_column_rows.return_value = [
            ("col1", "int", None),
            ("col2", "string", None),
            ("# Clustering Information", "", ""),
            ("clustering_col", "string", None),
        ]

        result = get_columns(
            self.mock_self,
            self.mock_connection,
            "test_table",
            "test_schema",
            db_name="test_db",
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ordinal_position"], 0)
        self.assertEqual(result[1]["ordinal_position"], 1)
