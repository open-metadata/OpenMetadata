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
Unit tests for Redshift ordinal position feature
"""

from unittest import TestCase
from unittest.mock import Mock

from metadata.ingestion.source.database.redshift.utils import get_columns


class RedshiftOrdinalPositionTest(TestCase):
    """
    Unit tests for Redshift ordinal position in column details
    """

    def setUp(self):
        """Set up test fixtures"""
        self.mock_self = Mock()
        self.mock_self._domains = {}
        self.mock_self._load_domains = Mock(return_value={})
        self.mock_connection = Mock()

    def _create_mock_column(
        self, name, format_type, attnum, distkey=False, sortkey=0, encode="none"
    ):
        """Helper to create a mock column object"""
        col = Mock()
        col.name = name
        col.format_type = format_type
        col.default = None
        col.notnull = False
        col.schema = "public"
        col.encode = encode
        col.comment = None
        col.distkey = distkey
        col.sortkey = sortkey
        col.attnum = attnum
        return col

    def test_ordinal_position_single_column(self):
        """Test that ordinal position is set for a single column"""
        mock_col = self._create_mock_column("id", "integer", attnum=1)
        self.mock_self._get_redshift_columns = Mock(return_value=[mock_col])

        self.mock_self._get_column_info = Mock(
            return_value={
                "name": "id",
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }
        )

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "id")
        self.assertEqual(result[0]["ordinal_position"], 1)

    def test_ordinal_position_multiple_columns(self):
        """Test ordinal position with multiple columns in order"""
        mock_cols = [
            self._create_mock_column("id", "bigint", attnum=1),
            self._create_mock_column("name", "character varying(256)", attnum=2),
            self._create_mock_column("email", "character varying(256)", attnum=3),
            self._create_mock_column(
                "created_at", "timestamp without time zone", attnum=4
            ),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "users", schema="public"
        )

        self.assertEqual(len(result), 4)
        self.assertEqual(result[0]["name"], "id")
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertEqual(result[1]["name"], "name")
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[2]["name"], "email")
        self.assertEqual(result[2]["ordinal_position"], 3)
        self.assertEqual(result[3]["name"], "created_at")
        self.assertEqual(result[3]["ordinal_position"], 4)

    def test_ordinal_position_with_various_data_types(self):
        """Test ordinal position with various Redshift data types"""
        mock_cols = [
            self._create_mock_column("smallint_col", "smallint", attnum=1),
            self._create_mock_column("integer_col", "integer", attnum=2),
            self._create_mock_column("bigint_col", "bigint", attnum=3),
            self._create_mock_column("decimal_col", "numeric(10,2)", attnum=4),
            self._create_mock_column("real_col", "real", attnum=5),
            self._create_mock_column("double_col", "double precision", attnum=6),
            self._create_mock_column("boolean_col", "boolean", attnum=7),
            self._create_mock_column("char_col", "character(10)", attnum=8),
            self._create_mock_column("varchar_col", "character varying(256)", attnum=9),
            self._create_mock_column("date_col", "date", attnum=10),
            self._create_mock_column(
                "timestamp_col", "timestamp without time zone", attnum=11
            ),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 11)
        for idx, column in enumerate(result, start=1):
            self.assertEqual(column["ordinal_position"], idx)

    def test_ordinal_position_with_distkey(self):
        """Test ordinal position with distkey column"""
        mock_cols = [
            self._create_mock_column("id", "integer", attnum=1, distkey=True),
            self._create_mock_column("name", "character varying(256)", attnum=2),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertEqual(result[0]["distkey"], True)
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[1]["distkey"], False)

    def test_ordinal_position_with_sortkey(self):
        """Test ordinal position with sortkey columns"""
        mock_cols = [
            self._create_mock_column("id", "integer", attnum=1, sortkey=1),
            self._create_mock_column(
                "created_at", "timestamp without time zone", attnum=2, sortkey=2
            ),
            self._create_mock_column("name", "character varying(256)", attnum=3),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertEqual(result[0]["sortkey"], 1)
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[1]["sortkey"], 2)
        self.assertEqual(result[2]["ordinal_position"], 3)
        self.assertEqual(result[2]["sortkey"], 0)

    def test_ordinal_position_with_encoding(self):
        """Test ordinal position with column encoding"""
        mock_cols = [
            self._create_mock_column("id", "integer", attnum=1, encode="az64"),
            self._create_mock_column(
                "name", "character varying(256)", attnum=2, encode="lzo"
            ),
            self._create_mock_column(
                "data", "character varying(1000)", attnum=3, encode="none"
            ),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            info = {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }
            encode = kwargs.get("encode")
            if encode and encode != "none":
                info["info"] = {"encode": encode}
            return info

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertIn("info", result[0])
        self.assertEqual(result[0]["info"]["encode"], "az64")
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[1]["info"]["encode"], "lzo")
        self.assertEqual(result[2]["ordinal_position"], 3)

    def test_ordinal_position_empty_result(self):
        """Test handling of empty column list"""
        self.mock_self._get_redshift_columns = Mock(return_value=[])

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 0)

    def test_ordinal_position_attribute_exists(self):
        """Test that ordinal_position key exists in result dictionary"""
        mock_col = self._create_mock_column("test_col", "integer", attnum=1)
        self.mock_self._get_redshift_columns = Mock(return_value=[mock_col])

        self.mock_self._get_column_info = Mock(
            return_value={
                "name": "test_col",
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }
        )

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 1)
        self.assertIn("ordinal_position", result[0])
        self.assertIsInstance(result[0]["ordinal_position"], int)
        self.assertEqual(result[0]["ordinal_position"], 1)

    def test_ordinal_position_with_system_data_type(self):
        """Test that system_data_type is preserved along with ordinal_position"""
        mock_cols = [
            self._create_mock_column("amount", "numeric(18,2)", attnum=1),
            self._create_mock_column("rate", "numeric(5,4)", attnum=2),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertEqual(result[0]["system_data_type"], "numeric(18,2)")
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[1]["system_data_type"], "numeric(5,4)")

    def test_ordinal_position_maintains_order(self):
        """Test that ordinal position maintains the order from Redshift"""
        mock_cols = [
            self._create_mock_column("z_column", "character varying(256)", attnum=4),
            self._create_mock_column("a_column", "integer", attnum=1),
            self._create_mock_column("m_column", "double precision", attnum=3),
            self._create_mock_column("b_column", "boolean", attnum=2),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": None,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 4)
        self.assertEqual(result[0]["name"], "z_column")
        self.assertEqual(result[0]["ordinal_position"], 4)
        self.assertEqual(result[1]["name"], "a_column")
        self.assertEqual(result[1]["ordinal_position"], 1)
        self.assertEqual(result[2]["name"], "m_column")
        self.assertEqual(result[2]["ordinal_position"], 3)
        self.assertEqual(result[3]["name"], "b_column")
        self.assertEqual(result[3]["ordinal_position"], 2)

    def test_ordinal_position_with_comments(self):
        """Test ordinal position when columns have comments"""
        mock_col1 = self._create_mock_column("id", "bigint", attnum=1)
        mock_col1.comment = "Primary key identifier"
        mock_col2 = self._create_mock_column(
            "email", "character varying(256)", attnum=2
        )
        mock_col2.comment = "User email address"
        mock_cols = [mock_col1, mock_col2]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            comment = kwargs.get("comment")
            return {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": comment,
            }

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertEqual(result[0]["comment"], "Primary key identifier")
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[1]["comment"], "User email address")

    def test_ordinal_position_combined_features(self):
        """Test ordinal position with combined distkey, sortkey, and encoding"""
        mock_cols = [
            self._create_mock_column(
                "id", "integer", attnum=1, distkey=True, sortkey=1, encode="az64"
            ),
            self._create_mock_column(
                "created_at",
                "timestamp without time zone",
                attnum=2,
                sortkey=2,
                encode="az64",
            ),
            self._create_mock_column(
                "name", "character varying(256)", attnum=3, encode="lzo"
            ),
        ]
        self.mock_self._get_redshift_columns = Mock(return_value=mock_cols)

        def mock_column_info(name, format_type, **kwargs):
            info = {
                "name": name,
                "type": Mock(),
                "nullable": True,
                "default": None,
                "autoincrement": False,
                "comment": kwargs.get("comment"),
            }
            encode = kwargs.get("encode")
            if encode and encode != "none":
                info["info"] = {"encode": encode}
            return info

        self.mock_self._get_column_info = Mock(side_effect=mock_column_info)

        result = get_columns(
            self.mock_self, self.mock_connection, "test_table", schema="public"
        )

        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["ordinal_position"], 1)
        self.assertEqual(result[0]["distkey"], True)
        self.assertEqual(result[0]["sortkey"], 1)
        self.assertEqual(result[1]["ordinal_position"], 2)
        self.assertEqual(result[1]["sortkey"], 2)
        self.assertEqual(result[2]["ordinal_position"], 3)
