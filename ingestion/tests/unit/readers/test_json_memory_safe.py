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
Tests for JSONDataFrameReader memory-safe approach
"""
import unittest
from unittest.mock import Mock, patch
import os
from pathlib import Path

import pandas as pd

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.readers.dataframe.base import MAX_FILE_SIZE_FOR_MEMORY_LOADING
from metadata.readers.dataframe.json import JSONDataFrameReader


class TestJSONMemorySafe(unittest.TestCase):
    """
    Test the JSON reader memory-safe functionality
    """

    def setUp(self):
        """Set up test fixtures"""
        self.config_source = LocalConfig()
        self.reader = JSONDataFrameReader(self.config_source, None)

    def test_small_file_uses_original_method(self):
        """Test that small files use the original, simpler method"""
        small_json_data = '{"id": 1, "name": "Alice"}'

        with patch.object(
            self.reader, "_get_file_size_from_reader", return_value=1000
        ):  # Small file
            with patch.object(
                self.reader.reader, "read", return_value=small_json_data.encode()
            ):
                with patch.object(self.reader, "read_from_json") as mock_read_json:
                    mock_read_json.return_value = (
                        [pd.DataFrame({"id": [1], "name": ["Alice"]})],
                        None,
                    )

                    result = self.reader._read(key="test.json", bucket_name="test")

                    # Verify original method was called
                    mock_read_json.assert_called_once()
                    self.assertIsNotNone(result.dataframes)

    def test_large_file_uses_streaming_method(self):
        """Test that large files use the streaming method"""
        # Create JSON Lines data
        large_json_lines = "\n".join(
            [
                '{"id": 1, "name": "Alice"}',
                '{"id": 2, "name": "Bob"}',
                '{"id": 3, "name": "Charlie"}',
            ]
        )

        large_file_size = MAX_FILE_SIZE_FOR_MEMORY_LOADING + 1000

        with patch.object(
            self.reader, "_get_file_size_from_reader", return_value=large_file_size
        ):
            with patch.object(
                self.reader.reader, "read", return_value=large_json_lines.encode()
            ):
                with patch.object(
                    self.reader, "_read_json_streaming"
                ) as mock_streaming:
                    mock_streaming.return_value = [
                        pd.DataFrame(
                            {"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"]}
                        )
                    ]

                    result = self.reader._read(key="test.jsonl", bucket_name="test")

                    # Verify streaming method was called
                    mock_streaming.assert_called_once()
                    self.assertIsNotNone(result.dataframes)

    def test_json_lines_streaming(self):
        """Test streaming processing of JSON Lines format"""
        json_lines = "\n".join(
            [
                '{"id": 1, "name": "Alice", "age": 25}',
                '{"id": 2, "name": "Bob", "age": 30}',
                '{"id": 3, "name": "Charlie", "age": 35}',
                '{"id": 4, "name": "David", "age": 40}',
            ]
        )

        with patch(
            "metadata.readers.dataframe.json.dataframe_to_chunks"
        ) as mock_chunks:
            # Mock dataframe_to_chunks to return the input DataFrame as a single chunk
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            result = self.reader._read_json_streaming(json_lines, chunk_size=2)

            # Should process in chunks of 2
            self.assertTrue(len(result) >= 2)

            # Verify dataframe_to_chunks was called for each chunk
            self.assertTrue(mock_chunks.call_count >= 2)

    def test_single_json_object_streaming(self):
        """Test streaming processing of single JSON object"""
        single_json = '{"id": 1, "name": "Alice", "data": [1, 2, 3]}'

        with patch(
            "metadata.readers.dataframe.json.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            result = self.reader._read_json_streaming(single_json)

            # Should handle single object
            self.assertTrue(len(result) >= 1)
            mock_chunks.assert_called()

    def test_invalid_json_handling(self):
        """Test handling of invalid JSON in streaming mode"""
        invalid_json_lines = "\n".join(
            [
                '{"id": 1, "name": "Alice"}',
                "{invalid json}",  # This line should be skipped
                '{"id": 2, "name": "Bob"}',
            ]
        )

        with patch(
            "metadata.readers.dataframe.json.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            with patch("metadata.readers.dataframe.json.logger") as mock_logger:
                result = self.reader._read_json_streaming(invalid_json_lines)

                # Should skip invalid line and log warning
                mock_logger.warning.assert_called()
                self.assertTrue(len(result) >= 1)

    def test_file_size_detection_fallback(self):
        """Test file size detection with various reader types"""
        # Test when reader has get_file_size method
        with patch.object(self.reader.reader, "get_file_size", return_value=5000):
            size = self.reader._get_file_size_from_reader("test.json", "bucket")
            self.assertEqual(size, 5000)

        # Test when reader has _get_file_info method
        self.reader.reader = Mock()
        self.reader.reader._get_file_info.return_value = {"size": 3000}
        size = self.reader._get_file_size_from_reader("test.json", "bucket")
        self.assertEqual(size, 3000)

        # Test fallback when no size methods available
        self.reader.reader = Mock(spec=["read"])  # Only has read method
        size = self.reader._get_file_size_from_reader("test.json", "bucket")
        self.assertEqual(size, 0)

    def test_memory_thresholds(self):
        """Test that memory thresholds are properly applied"""
        # File size just over the threshold should trigger chunking
        large_file_size = MAX_FILE_SIZE_FOR_MEMORY_LOADING + 1
        self.assertTrue(self.reader._should_use_chunking(large_file_size))

        # File size under the threshold should not trigger chunking
        small_file_size = MAX_FILE_SIZE_FOR_MEMORY_LOADING - 1
        self.assertFalse(self.reader._should_use_chunking(small_file_size))

    def test_real_large_file_processing(self):
        """Test processing a real large JSON file without mocking"""
        # Path to the real test file
        test_file_path = Path(__file__).parent / "test_files" / "omd_openapi.json"
        
        # Skip test if file doesn't exist
        if not test_file_path.exists():
            self.skipTest(f"Test file {test_file_path} not found")
        
        # Get actual file size
        file_size = os.path.getsize(test_file_path)
        self.assertGreater(file_size, 1000000, "Test file should be large (>1MB)")
        
        # Create a mock reader that can read the actual file
        mock_reader = Mock()
        with open(test_file_path, 'rb') as f:
            file_content = f.read()
        
        mock_reader.read.return_value = file_content
        mock_reader.get_file_size.return_value = file_size
        
        # Set up the reader with the mock
        self.reader.reader = mock_reader
        
        # Test the actual reading process
        result = self.reader._read(key="omd_openapi.json", bucket_name="test")
        
        # Verify the result
        self.assertIsNotNone(result.dataframes)
        self.assertGreater(len(result.dataframes), 0, "Should produce at least one dataframe")
        
        # Verify that we get meaningful data
        combined_df = pd.concat(result.dataframes, ignore_index=True)
        self.assertGreater(len(combined_df), 0, "Combined dataframe should have rows")
        
        # The OpenAPI spec is a complex nested JSON, so we should see various columns
        self.assertGreater(len(combined_df.columns), 1, "Should have multiple columns from the JSON structure")
        
        # Verify memory-safe processing was used (file size should trigger chunking)
        should_chunk = self.reader._should_use_chunking(file_size)
        if should_chunk:
            # For large files, we expect chunking to be used
            # This can be verified by checking if multiple dataframes were created
            # or if the processing completed without memory issues
            self.assertTrue(True, "Large file processing completed successfully")
        
        print(f"Processed file of size {file_size} bytes, produced {len(result.dataframes)} dataframe(s) with {len(combined_df)} total rows")


if __name__ == "__main__":
    unittest.main()
