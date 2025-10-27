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
MF4 reader tests
"""
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.readers.dataframe.mf4 import MF4DataFrameReader
from metadata.readers.dataframe.models import DatalakeColumnWrapper


class TestMF4DataFrameReader(TestCase):
    """
    Test MF4DataFrameReader functionality
    """

    @patch("metadata.readers.dataframe.base.get_reader")
    def setUp(self, mock_get_reader):
        """Set up test fixtures"""
        # MF4DataFrameReader requires config_source and client
        mock_config_source = MagicMock()
        mock_client = MagicMock()

        # Mock the reader that get_reader returns
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        self.reader = MF4DataFrameReader(
            config_source=mock_config_source, client=mock_client
        )
        self.mock_reader = mock_reader

    def test_extract_schema_from_header_with_common_properties(self):
        """
        Test extracting schema from MF4 header with _common_properties
        """
        # Mock MF4 bytes
        mock_mf4_bytes = b"mock_mf4_content"

        # Expected common properties
        expected_common_props = {
            "measurement_id": "TEST_001",
            "vehicle_id": "VEH_123",
            "test_date": "2025-01-01",
            "sample_rate": 1000.0,
            "channels_count": 10,
            "duration": 3600.0,
        }

        # Create mock MDF object with header
        with patch("asammdf.MDF") as mock_mdf_class:
            mock_mdf = MagicMock()
            mock_header = MagicMock()
            mock_header._common_properties = expected_common_props
            mock_mdf.header = mock_header
            mock_mdf_class.return_value = mock_mdf

            # Call the method
            result = MF4DataFrameReader.extract_schema_from_header(mock_mf4_bytes)
            # Validate result
            self.assertIsInstance(result, DatalakeColumnWrapper)
            self.assertIsNotNone(result.dataframes)
            self.assertEqual(result.raw_data, expected_common_props)

    def test_extract_schema_from_header_without_common_properties(self):
        """
        Test extracting schema when no _common_properties exist
        """
        mock_mf4_bytes = b"mock_mf4_content"

        with patch("asammdf.MDF") as mock_mdf_class:
            mock_mdf = MagicMock()
            mock_header = MagicMock()
            # No _common_properties attribute
            del mock_header._common_properties
            mock_mdf.header = mock_header
            mock_mdf_class.return_value = mock_mdf

            # Call the method
            result = MF4DataFrameReader.extract_schema_from_header(mock_mf4_bytes)

            # Should return None when no properties found
            self.assertIsNone(result)
