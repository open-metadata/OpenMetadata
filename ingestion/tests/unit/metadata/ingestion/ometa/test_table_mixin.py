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
Test Table Mixin methods for handling special data types
"""
import ipaddress
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.type.basic import Uuid
from metadata.ingestion.ometa.mixins.table_mixin import OMetaTableMixin


class TestTableMixin(TestCase):
    """Test OMetaTableMixin special data type handling"""

    def setUp(self):
        """Set up test fixtures"""
        self.mixin = OMetaTableMixin()
        self.mixin.client = MagicMock()
        self.mixin.get_suffix = MagicMock(return_value="/tables")

        # Create a mock table
        self.table = Table(
            id=Uuid("12345678-1234-1234-1234-123456789012"),
            name="test_table",
            fullyQualifiedName="test.db.schema.test_table",
        )

    def test_ingest_sample_data_with_ipv4_address(self):
        """Test that IPv4Address objects are converted to strings"""
        # Create sample data with IPv4Address
        sample_data = TableData(
            columns=["id", "ip_address"],
            rows=[
                [1, ipaddress.IPv4Address("192.168.1.1")],
                [2, ipaddress.IPv4Address("10.0.0.1")],
            ],
        )

        # Mock the client.put response
        self.mixin.client.put.return_value = {
            "sampleData": {
                "columns": ["id", "ip_address"],
                "rows": [[1, "192.168.1.1"], [2, "10.0.0.1"]],
            }
        }

        # Call the method
        result = self.mixin.ingest_table_sample_data(self.table, sample_data)

        # Verify the client.put was called
        self.mixin.client.put.assert_called_once()

        # Verify the data was converted properly (check the call arguments)
        call_args = self.mixin.client.put.call_args
        self.assertIsNotNone(call_args)

        # The sample_data rows should have been modified in place
        self.assertEqual(sample_data.rows[0][1], "192.168.1.1")
        self.assertEqual(sample_data.rows[1][1], "10.0.0.1")

        # Verify result contains the expected data
        self.assertIsNotNone(result)
        self.assertEqual(result.columns, ["id", "ip_address"])

    def test_ingest_sample_data_with_ipv6_address(self):
        """Test that IPv6Address objects are converted to strings"""
        # Create sample data with IPv6Address
        sample_data = TableData(
            columns=["id", "ipv6_address"],
            rows=[
                [1, ipaddress.IPv6Address("2001:db8::1")],
                [2, ipaddress.IPv6Address("fe80::1")],
            ],
        )

        # Mock the client.put response
        self.mixin.client.put.return_value = {
            "sampleData": {
                "columns": ["id", "ipv6_address"],
                "rows": [[1, "2001:db8::1"], [2, "fe80::1"]],
            }
        }

        # Call the method
        result = self.mixin.ingest_table_sample_data(self.table, sample_data)

        # Verify the data was converted properly
        self.assertEqual(sample_data.rows[0][1], "2001:db8::1")
        self.assertEqual(sample_data.rows[1][1], "fe80::1")

        # Verify result contains the expected data
        self.assertIsNotNone(result)

    def test_ingest_sample_data_with_mixed_types(self):
        """Test handling of mixed data types including IP addresses, bytes, and normal data"""
        # Create sample data with mixed types
        sample_data = TableData(
            columns=["id", "name", "ip_address", "binary_data"],
            rows=[
                [
                    1,
                    "test",
                    ipaddress.IPv4Address("192.168.1.1"),
                    b"binary\x00data",
                ],
                [2, "test2", ipaddress.IPv6Address("2001:db8::1"), b"more\x00binary"],
            ],
        )

        # Mock the client.put response
        self.mixin.client.put.return_value = {
            "sampleData": {
                "columns": ["id", "name", "ip_address", "binary_data"],
                "rows": [
                    [1, "test", "192.168.1.1", "[base64]YmluYXJ5AGRhdGE="],
                    [2, "test2", "2001:db8::1", "[base64]bW9yZQBiaW5hcnk="],
                ],
            }
        }

        # Call the method
        result = self.mixin.ingest_table_sample_data(self.table, sample_data)

        # Verify the IP addresses were converted
        self.assertEqual(sample_data.rows[0][2], "192.168.1.1")
        self.assertEqual(sample_data.rows[1][2], "2001:db8::1")

        # Verify the binary data was converted to base64
        self.assertTrue(sample_data.rows[0][3].startswith("[base64]"))
        self.assertTrue(sample_data.rows[1][3].startswith("[base64]"))

        # Regular strings should remain unchanged
        self.assertEqual(sample_data.rows[0][1], "test")
        self.assertEqual(sample_data.rows[1][1], "test2")

        # Verify result
        self.assertIsNotNone(result)

    def test_ingest_sample_data_with_none_values(self):
        """Test that None values and empty rows are handled correctly"""
        # Create sample data with None values
        sample_data = TableData(
            columns=["id", "ip_address"],
            rows=[
                [1, ipaddress.IPv4Address("192.168.1.1")],
                [2, None],
                None,  # Empty row
                [3, ipaddress.IPv4Address("10.0.0.1")],
            ],
        )

        # Mock the client.put response
        self.mixin.client.put.return_value = {
            "sampleData": {
                "columns": ["id", "ip_address"],
                "rows": [[1, "192.168.1.1"], [2, None], None, [3, "10.0.0.1"]],
            }
        }

        # Call the method
        result = self.mixin.ingest_table_sample_data(self.table, sample_data)

        # Verify the IP addresses were converted
        self.assertEqual(sample_data.rows[0][1], "192.168.1.1")
        self.assertEqual(sample_data.rows[1][1], None)
        self.assertIsNone(sample_data.rows[2])
        self.assertEqual(sample_data.rows[3][1], "10.0.0.1")

        # Verify result
        self.assertIsNotNone(result)

    def test_ingest_sample_data_serialization_error_handling(self):
        """Test that serialization errors are caught and logged"""
        # Create sample data
        sample_data = TableData(
            columns=["id", "ip_address"],
            rows=[[1, ipaddress.IPv4Address("192.168.1.1")]],
        )

        # Mock the client.put to raise an exception
        self.mixin.client.put.side_effect = Exception("Serialization error")

        # Call the method - should not raise an exception
        result = self.mixin.ingest_table_sample_data(self.table, sample_data)

        # Verify result is None due to the error
        self.assertIsNone(result)
