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
Test StarRocks using the topology
"""

from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.starrocks.metadata import (
    _get_column,
    _parse_type,
    extract_child,
    extract_number,
)

mock_starrocks_config = {
    "source": {
        "type": "starrocks",
        "serviceName": "local_starrocks",
        "serviceConnection": {
            "config": {
                "type": "StarRocks",
                "username": "root",
                "hostPort": "localhost:9030",
                "password": "test",
                "sslConfig": {
                    "caCertificate": "-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJAK...\n-----END CERTIFICATE-----\n",
                },
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DatabaseMetadata",
            }
        },
    },
    "sink": {
        "type": "metadata-rest",
        "config": {},
    },
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "starrocks"},
        }
    },
}


class StarRocksHelperFunctionsTest(TestCase):
    """Test helper functions for StarRocks metadata extraction"""

    def test_extract_number_char(self):
        """Test extracting length from CHAR type"""
        result = extract_number("CHAR(10)")
        self.assertEqual(result, [10])

    def test_extract_number_varchar(self):
        """Test extracting length from VARCHAR type"""
        result = extract_number("VARCHAR(255)")
        self.assertEqual(result, [255])

    def test_extract_number_decimal(self):
        """Test extracting precision and scale from DECIMAL type"""
        result = extract_number("DECIMAL(10,2)")
        self.assertEqual(result, [10, 2])

    def test_extract_number_decimalv3(self):
        """Test extracting precision and scale from DECIMALV3 type"""
        result = extract_number("DECIMALV3(9,0)")
        self.assertEqual(result, [9, 0])

    def test_extract_number_no_parentheses(self):
        """Test extract_number with no parentheses returns empty list"""
        result = extract_number("INT")
        self.assertEqual(result, [])

    def test_extract_number_non_numeric(self):
        """Test extract_number with non-numeric content returns empty list"""
        result = extract_number("VARCHAR(*)")
        self.assertEqual(result, [])

    def test_extract_child_array(self):
        """Test extracting child type from ARRAY"""
        result = extract_child("ARRAY<INT(11)>")
        self.assertEqual(result, "INT(11)")

    def test_extract_child_struct(self):
        """Test extracting child content from STRUCT"""
        result = extract_child("STRUCT<s_id:int(11),s_name:text>")
        self.assertEqual(result, "s_id:int(11),s_name:text")

    def test_extract_child_no_angle_brackets(self):
        """Test extract_child with no angle brackets returns empty string"""
        result = extract_child("VARCHAR(255)")
        self.assertEqual(result, "")

    def test_parse_type_basic(self):
        """Test parsing basic types"""
        self.assertEqual(_parse_type("INT"), "INT")
        self.assertEqual(_parse_type("VARCHAR(255)"), "VARCHAR")
        self.assertEqual(_parse_type("CHAR(10)"), "CHAR")

    def test_parse_type_decimal(self):
        """Test parsing DECIMAL type with version suffix"""
        self.assertEqual(_parse_type("DECIMAL(10,2)"), "DECIMAL")
        self.assertEqual(_parse_type("DECIMALV3(9,0)"), "DECIMAL")

    def test_parse_type_date_version(self):
        """Test parsing DATE type with version suffix"""
        self.assertEqual(_parse_type("DATE"), "DATE")
        self.assertEqual(_parse_type("DATEV2"), "DATE")

    def test_parse_type_array(self):
        """Test parsing ARRAY type"""
        self.assertEqual(_parse_type("ARRAY<INT>"), "ARRAY")

    def test_parse_type_struct(self):
        """Test parsing STRUCT type"""
        self.assertEqual(_parse_type("STRUCT<s_id:int>"), "STRUCT")

    def test_parse_type_lowercase(self):
        """Test parsing lowercase type names"""
        self.assertEqual(_parse_type("varchar(255)"), "VARCHAR")
        self.assertEqual(_parse_type("int"), "INT")

    def test_get_column_basic(self):
        """Test _get_column with basic column info"""
        result = _get_column(0, "id", "INT", "NO", None, "Primary key")
        self.assertEqual(result["name"], "id")
        self.assertEqual(result["system_data_type"], "INT")
        self.assertFalse(result["nullable"])
        self.assertEqual(result["comment"], "Primary key")
        self.assertEqual(result["ordinalPosition"], 0)

    def test_get_column_varchar(self):
        """Test _get_column with VARCHAR type"""
        result = _get_column(1, "name", "VARCHAR(100)", "YES", "'default'", None)
        self.assertEqual(result["name"], "name")
        self.assertEqual(result["system_data_type"], "VARCHAR")
        self.assertEqual(result["data_length"], 100)
        self.assertTrue(result["nullable"])
        self.assertEqual(result["default"], "'default'")

    def test_get_column_decimal(self):
        """Test _get_column with DECIMAL type"""
        result = _get_column(2, "amount", "DECIMAL(10,2)", "YES", None, None)
        self.assertEqual(result["system_data_type"], "DECIMAL")
        self.assertEqual(result["precision"], 10)
        self.assertEqual(result["scale"], 2)

    def test_get_column_array(self):
        """Test _get_column with ARRAY type"""
        result = _get_column(3, "tags", "ARRAY<VARCHAR(50)>", "YES", None, None)
        self.assertEqual(result["system_data_type"], "ARRAY")
        self.assertEqual(result["arr_data_type"], "VARCHAR")

    def test_get_column_struct(self):
        """Test _get_column with STRUCT type"""
        result = _get_column(
            4, "metadata", "STRUCT<key:varchar(50),value:int>", "YES", None, None
        )
        self.assertEqual(result["system_data_type"], "STRUCT")
        self.assertIsNotNone(result["children"])
        self.assertEqual(len(result["children"]), 2)
        self.assertEqual(result["children"][0]["name"], "key")
        self.assertEqual(result["children"][1]["name"], "value")


class StarRocksUnitTest(TestCase):
    """Test StarRocks source creation and connection handling.

    Note: These tests require the StarRocks models to be generated via `make generate`.
    They will be skipped if the models are not available.
    """

    @classmethod
    def setUpClass(cls):
        try:
            cls.models_available = True
        except ImportError:
            cls.models_available = False

    def setUp(self):
        if not self.models_available:
            self.skipTest("StarRocks models not generated. Run 'make generate' first.")

    @patch("metadata.ingestion.source.database.starrocks.connection.get_connection")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    def test_source_created(self, test_connection, get_connection):
        """Test that StarRocksSource is created successfully"""
        test_connection.return_value = False
        get_connection.return_value = MagicMock()

        config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config)

        from metadata.ingestion.source.database.starrocks.metadata import (
            StarRocksSource,
        )

        starrocks_source = StarRocksSource.create(
            mock_starrocks_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.assertIsNotNone(starrocks_source)

    @patch("metadata.ingestion.source.database.starrocks.connection.get_connection")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.test_connection"
    )
    @patch("sqlalchemy.engine.base.Engine")
    @patch(
        "metadata.ingestion.source.database.common_db_source.CommonDbSourceService.connection"
    )
    def test_close_connection(
        self, connection, engine, test_connection, get_connection
    ):
        """Test that close() can be called without error"""
        test_connection.return_value = False
        get_connection.return_value = MagicMock()
        connection.return_value = True

        config = OpenMetadataWorkflowConfig.model_validate(mock_starrocks_config)

        from metadata.ingestion.source.database.starrocks.metadata import (
            StarRocksSource,
        )

        starrocks_source = StarRocksSource.create(
            mock_starrocks_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        starrocks_source.close()
