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
Unit tests for Unity Catalog ordinal position feature
"""

from unittest import TestCase
from unittest.mock import Mock

from databricks.sdk.service.catalog import ColumnInfo

from metadata.ingestion.source.database.unitycatalog.metadata import UnitycatalogSource


class UnityCatalogOrdinalPositionTest(TestCase):
    """
    Unit tests for Unity Catalog ordinal position in column details
    """

    def setUp(self):
        """Set up test fixtures"""
        self.source = Mock(spec=UnitycatalogSource)
        self.source.get_column_tag_labels = Mock(return_value=[])

    def test_ordinal_position_single_column(self):
        """Test that ordinal position is set for a single column"""
        column_data = [
            ColumnInfo(
                name="id",
                type_text="INT",
                type_json='{"name":"id","type":"integer","nullable":false}',
                position=0,
                comment="ID column",
            )
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 1)
        self.assertEqual(columns[0].name.root, "id")
        self.assertEqual(columns[0].ordinalPosition, 0)

    def test_ordinal_position_multiple_columns(self):
        """Test ordinal position with multiple columns"""
        column_data = [
            ColumnInfo(
                name="id",
                type_text="INT",
                type_json='{"name":"id","type":"integer","nullable":false}',
                position=0,
                comment=None,
            ),
            ColumnInfo(
                name="name",
                type_text="STRING",
                type_json='{"name":"name","type":"string","nullable":true}',
                position=1,
                comment="Name column",
            ),
            ColumnInfo(
                name="created_at",
                type_text="TIMESTAMP",
                type_json='{"name":"created_at","type":"timestamp","nullable":true}',
                position=2,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 3)
        self.assertEqual(columns[0].name.root, "id")
        self.assertEqual(columns[0].ordinalPosition, 0)
        self.assertEqual(columns[1].name.root, "name")
        self.assertEqual(columns[1].ordinalPosition, 1)
        self.assertEqual(columns[2].name.root, "created_at")
        self.assertEqual(columns[2].ordinalPosition, 2)

    def test_ordinal_position_with_complex_types(self):
        """Test ordinal position with complex data types"""
        column_data = [
            ColumnInfo(
                name="simple_col",
                type_text="STRING",
                type_json='{"name":"simple_col","type":"string","nullable":true}',
                position=0,
                comment=None,
            ),
            ColumnInfo(
                name="array_col",
                type_text="ARRAY<INT>",
                type_json='{"name":"array_col","type":{"type":"array","elementType":"integer"},"nullable":true}',
                position=1,
                comment=None,
            ),
            ColumnInfo(
                name="struct_col",
                type_text="STRUCT<field1:STRING,field2:INT>",
                type_json='{"name":"struct_col","type":{"type":"struct","fields":[{"name":"field1","type":"string"},{"name":"field2","type":"integer"}]},"nullable":true}',
                position=2,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 3)
        self.assertEqual(columns[0].ordinalPosition, 0)
        self.assertEqual(columns[1].ordinalPosition, 1)
        self.assertEqual(columns[2].ordinalPosition, 2)

    def test_ordinal_position_with_various_data_types(self):
        """Test ordinal position with various Unity Catalog data types"""
        column_data = [
            ColumnInfo(
                name="int_col",
                type_text="INT",
                type_json='{"name":"int_col","type":"integer","nullable":true}',
                position=0,
                comment=None,
            ),
            ColumnInfo(
                name="bigint_col",
                type_text="BIGINT",
                type_json='{"name":"bigint_col","type":"long","nullable":true}',
                position=1,
                comment=None,
            ),
            ColumnInfo(
                name="float_col",
                type_text="FLOAT",
                type_json='{"name":"float_col","type":"float","nullable":true}',
                position=2,
                comment=None,
            ),
            ColumnInfo(
                name="double_col",
                type_text="DOUBLE",
                type_json='{"name":"double_col","type":"double","nullable":true}',
                position=3,
                comment=None,
            ),
            ColumnInfo(
                name="string_col",
                type_text="STRING",
                type_json='{"name":"string_col","type":"string","nullable":true}',
                position=4,
                comment=None,
            ),
            ColumnInfo(
                name="boolean_col",
                type_text="BOOLEAN",
                type_json='{"name":"boolean_col","type":"boolean","nullable":true}',
                position=5,
                comment=None,
            ),
            ColumnInfo(
                name="date_col",
                type_text="DATE",
                type_json='{"name":"date_col","type":"date","nullable":true}',
                position=6,
                comment=None,
            ),
            ColumnInfo(
                name="timestamp_col",
                type_text="TIMESTAMP",
                type_json='{"name":"timestamp_col","type":"timestamp","nullable":true}',
                position=7,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 8)
        for idx, column in enumerate(columns):
            self.assertEqual(column.ordinalPosition, idx)

    def test_ordinal_position_non_sequential(self):
        """Test ordinal position with non-sequential position values"""
        column_data = [
            ColumnInfo(
                name="col_a",
                type_text="STRING",
                type_json='{"name":"col_a","type":"string","nullable":true}',
                position=5,
                comment=None,
            ),
            ColumnInfo(
                name="col_b",
                type_text="INT",
                type_json='{"name":"col_b","type":"integer","nullable":true}',
                position=10,
                comment=None,
            ),
            ColumnInfo(
                name="col_c",
                type_text="DOUBLE",
                type_json='{"name":"col_c","type":"double","nullable":true}',
                position=15,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 3)
        self.assertEqual(columns[0].ordinalPosition, 5)
        self.assertEqual(columns[1].ordinalPosition, 10)
        self.assertEqual(columns[2].ordinalPosition, 15)

    def test_ordinal_position_with_comment(self):
        """Test that ordinal position is set correctly when columns have comments"""
        column_data = [
            ColumnInfo(
                name="id",
                type_text="BIGINT",
                type_json='{"name":"id","type":"long","nullable":false}',
                position=0,
                comment="Primary key identifier",
            ),
            ColumnInfo(
                name="email",
                type_text="STRING",
                type_json='{"name":"email","type":"string","nullable":true}',
                position=1,
                comment="User email address",
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 2)
        self.assertEqual(columns[0].ordinalPosition, 0)
        self.assertEqual(columns[0].description.root, "Primary key identifier")
        self.assertEqual(columns[1].ordinalPosition, 1)
        self.assertEqual(columns[1].description.root, "User email address")

    def test_ordinal_position_empty_column_list(self):
        """Test handling of empty column list"""
        column_data = []

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 0)

    def test_ordinal_position_with_array_type(self):
        """Test ordinal position with array data type"""
        column_data = [
            ColumnInfo(
                name="tags",
                type_text="ARRAY<STRING>",
                type_json='{"name":"tags","type":{"type":"array","elementType":"string"},"nullable":true}',
                position=0,
                comment="Array of tags",
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 1)
        self.assertEqual(columns[0].ordinalPosition, 0)
        self.assertEqual(columns[0].name.root, "tags")

    def test_ordinal_position_with_struct_type(self):
        """Test ordinal position with struct data type"""
        column_data = [
            ColumnInfo(
                name="address",
                type_text="STRUCT<street:STRING,city:STRING,zip:INT>",
                type_json='{"name":"address","type":{"type":"struct","fields":[{"name":"street","type":"string"},{"name":"city","type":"string"},{"name":"zip","type":"integer"}]},"nullable":true}',
                position=0,
                comment="Address structure",
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 1)
        self.assertEqual(columns[0].ordinalPosition, 0)
        self.assertEqual(columns[0].name.root, "address")

    def test_ordinal_position_with_long_column_name(self):
        """Test that column names longer than 256 chars are truncated but ordinal position preserved"""
        long_name = "very_long_column_name_" * 20
        column_data = [
            ColumnInfo(
                name=long_name,
                type_text="STRING",
                type_json=f'{{"name":"{long_name}","type":"string","nullable":true}}',
                position=0,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 1)
        self.assertEqual(columns[0].ordinalPosition, 0)
        self.assertEqual(len(columns[0].name.root), 256)

    def test_ordinal_position_attribute_exists(self):
        """Test that ordinalPosition attribute exists in Column object"""
        column_data = [
            ColumnInfo(
                name="test_col",
                type_text="INT",
                type_json='{"name":"test_col","type":"integer","nullable":true}',
                position=5,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 1)
        self.assertTrue(hasattr(columns[0], "ordinalPosition"))
        self.assertIsNotNone(columns[0].ordinalPosition)
        self.assertIsInstance(columns[0].ordinalPosition, int)
        self.assertEqual(columns[0].ordinalPosition, 5)

    def test_ordinal_position_zero_indexed(self):
        """Test that ordinal position supports zero-indexed positions"""
        column_data = [
            ColumnInfo(
                name="first_col",
                type_text="STRING",
                type_json='{"name":"first_col","type":"string","nullable":true}',
                position=0,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 1)
        self.assertEqual(columns[0].ordinalPosition, 0)

    def test_ordinal_position_preserves_order(self):
        """Test that columns preserve ordinal position order through processing"""
        column_data = [
            ColumnInfo(
                name="z_col",
                type_text="STRING",
                type_json='{"name":"z_col","type":"string","nullable":true}',
                position=2,
                comment=None,
            ),
            ColumnInfo(
                name="a_col",
                type_text="INT",
                type_json='{"name":"a_col","type":"integer","nullable":true}',
                position=0,
                comment=None,
            ),
            ColumnInfo(
                name="m_col",
                type_text="DOUBLE",
                type_json='{"name":"m_col","type":"double","nullable":true}',
                position=1,
                comment=None,
            ),
        ]

        columns = list(
            UnitycatalogSource.get_columns(self.source, "test_table", column_data)
        )

        self.assertEqual(len(columns), 3)
        self.assertEqual(columns[0].name.root, "z_col")
        self.assertEqual(columns[0].ordinalPosition, 2)
        self.assertEqual(columns[1].name.root, "a_col")
        self.assertEqual(columns[1].ordinalPosition, 0)
        self.assertEqual(columns[2].name.root, "m_col")
        self.assertEqual(columns[2].ordinalPosition, 1)
