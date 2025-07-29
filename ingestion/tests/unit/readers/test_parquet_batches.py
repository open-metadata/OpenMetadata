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
Tests for ParquetDataFrameReader _read_parquet_in_batches method
"""
import unittest
from unittest.mock import Mock, patch

import pandas as pd

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.readers.dataframe.common import dataframe_to_chunks
from metadata.readers.dataframe.parquet import ParquetDataFrameReader


class TestParquetBatchReading(unittest.TestCase):
    """
    Test the _read_parquet_in_batches method functionality
    """

    def setUp(self):
        """Set up test fixtures"""
        self.config_source = LocalConfig()
        self.reader = ParquetDataFrameReader(self.config_source, None)

    def test_successful_batch_reading_with_iter_batches(self):
        """Test successful batched reading when iter_batches is available"""
        # Create mock parquet file with iter_batches capability
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Create sample data for two batches
        batch1_data = pd.DataFrame(
            {"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"], "age": [25, 30, 35]}
        )
        batch2_data = pd.DataFrame(
            {"id": [4, 5], "name": ["David", "Eve"], "age": [40, 45]}
        )

        # Create mock arrow table batches
        mock_batch1 = Mock()
        mock_batch1.to_pandas.return_value = batch1_data
        mock_batch2 = Mock()
        mock_batch2.to_pandas.return_value = batch2_data

        mock_parquet_file.iter_batches.return_value = iter([mock_batch1, mock_batch2])

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            # Mock dataframe_to_chunks to return list of chunks per dataframe
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            # Test the method
            result = self.reader._read_parquet_in_batches(
                mock_parquet_file, batch_size=1000
            )

            # Verify iter_batches was called with correct batch_size
            mock_parquet_file.iter_batches.assert_called_once_with(batch_size=1000)

            # Verify dataframe_to_chunks was called twice (once per batch)
            self.assertEqual(mock_chunks.call_count, 2)

            # Verify result contains chunks from both batches
            self.assertEqual(len(result), 2)
            pd.testing.assert_frame_equal(result[0], batch1_data)
            pd.testing.assert_frame_equal(result[1], batch2_data)

    def test_batch_reading_with_empty_batches(self):
        """Test that empty batches are properly skipped"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Create one non-empty and one empty batch
        non_empty_batch = pd.DataFrame({"id": [1], "name": ["Alice"]})
        empty_batch = pd.DataFrame()

        mock_batch1 = Mock()
        mock_batch1.to_pandas.return_value = non_empty_batch
        mock_batch2 = Mock()
        mock_batch2.to_pandas.return_value = empty_batch

        mock_parquet_file.iter_batches.return_value = iter([mock_batch1, mock_batch2])

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            result = self.reader._read_parquet_in_batches(mock_parquet_file)

            # Should only call dataframe_to_chunks once for non-empty batch
            mock_chunks.assert_called_once_with(non_empty_batch)

            # Result should only contain the non-empty batch
            self.assertEqual(len(result), 1)
            pd.testing.assert_frame_equal(result[0], non_empty_batch)

    def test_exception_handling_with_successful_fallback(self):
        """Test exception handling when batching fails but fallback succeeds"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Make iter_batches raise an exception
        mock_parquet_file.iter_batches.side_effect = Exception("Batching failed")

        # But make regular read work
        sample_data = pd.DataFrame({"id": [1, 2], "name": ["Alice", "Bob"]})
        mock_arrow_table = Mock()
        mock_arrow_table.to_pandas.return_value = sample_data
        mock_parquet_file.read.return_value = mock_arrow_table

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.return_value = [sample_data]

            with patch("metadata.readers.dataframe.parquet.logger") as mock_logger:
                result = self.reader._read_parquet_in_batches(mock_parquet_file)

                # Verify warning was logged about fallback
                mock_logger.warning.assert_called_with(
                    "Batched reading failed: Batching failed. Falling back to regular reading - "
                    "this may cause memory issues for large files"
                )

                # Verify regular read was used as fallback
                mock_parquet_file.read.assert_called_once()

                # Verify result
                self.assertEqual(result, [sample_data])

    def test_exception_handling_with_failed_fallback(self):
        """Test when both batching and fallback fail"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Make both iter_batches and read fail
        mock_parquet_file.iter_batches.side_effect = Exception("Batching failed")
        mock_parquet_file.read.side_effect = Exception("Regular read failed")

        with patch("metadata.readers.dataframe.parquet.logger") as mock_logger:
            # Should raise the fallback exception
            with self.assertRaises(Exception) as context:
                self.reader._read_parquet_in_batches(mock_parquet_file)

            self.assertEqual(str(context.exception), "Regular read failed")

            # Verify error was logged
            mock_logger.error.assert_called_with(
                "Failed to read parquet file: Regular read failed"
            )

    def test_custom_batch_size(self):
        """Test that custom batch size is properly passed to iter_batches"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Create a simple batch
        batch_data = pd.DataFrame({"id": [1], "name": ["Alice"]})
        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data

        mock_parquet_file.iter_batches.return_value = iter([mock_batch])

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.return_value = [batch_data]

            # Test with custom batch size
            custom_batch_size = 5000
            self.reader._read_parquet_in_batches(
                mock_parquet_file, batch_size=custom_batch_size
            )

            # Verify custom batch size was used
            mock_parquet_file.iter_batches.assert_called_once_with(
                batch_size=custom_batch_size
            )

    def test_batch_counting_and_logging(self):
        """Test that batch counting and logging work correctly"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Create multiple batches
        batches_data = [
            pd.DataFrame({"id": [1], "name": ["Alice"]}),
            pd.DataFrame({"id": [2], "name": ["Bob"]}),
            pd.DataFrame({"id": [3], "name": ["Charlie"]}),
        ]

        mock_batches = []
        for data in batches_data:
            mock_batch = Mock()
            mock_batch.to_pandas.return_value = data
            mock_batches.append(mock_batch)

        mock_parquet_file.iter_batches.return_value = iter(mock_batches)

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            with patch("metadata.readers.dataframe.parquet.logger") as mock_logger:
                result = self.reader._read_parquet_in_batches(mock_parquet_file)

                # Verify info logs were called
                mock_logger.info.assert_any_call(
                    "Reading large parquet file in batches to avoid memory issues"
                )
                mock_logger.info.assert_any_call(
                    "Successfully processed 3 batches from large parquet file"
                )

                # Verify all batches were processed
                self.assertEqual(len(result), 3)

    def test_dataframe_to_chunks_integration(self):
        """Test integration with dataframe_to_chunks function"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        # Create a batch that would generate multiple chunks
        batch_data = pd.DataFrame(
            {
                "id": list(
                    range(1000)
                ),  # Large enough to potentially create multiple chunks
                "name": [f"User{i}" for i in range(1000)],
            }
        )

        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data
        mock_parquet_file.iter_batches.return_value = iter([mock_batch])

        # Use real dataframe_to_chunks function
        result = self.reader._read_parquet_in_batches(mock_parquet_file)

        # Verify that result is a list of dataframes (chunks)
        self.assertIsInstance(result, list)
        self.assertTrue(len(result) > 0)

        # Verify that all chunks are DataFrames
        for chunk in result:
            self.assertIsInstance(chunk, pd.DataFrame)

        # Verify that concatenating all chunks gives us back the original data
        if len(result) > 1:
            concatenated = pd.concat(result, ignore_index=True)
            pd.testing.assert_frame_equal(concatenated, batch_data)
        else:
            pd.testing.assert_frame_equal(result[0], batch_data)

    def test_real_parquet_file_batch_processing(self):
        """Test batch processing with real flights-1m.parquet file (7MB)"""
        import os

        from pyarrow.parquet import ParquetFile

        # Path to the test parquet file
        test_file_path = os.path.join(
            os.path.dirname(__file__), "test_files", "flights-1m.parquet"
        )

        # Skip test if file doesn't exist
        if not os.path.exists(test_file_path):
            self.skipTest(f"Test file not found: {test_file_path}")

        try:
            # Create ParquetFile object from real file
            parquet_file = ParquetFile(test_file_path)

            # Get some basic info about the file
            file_size = os.path.getsize(test_file_path)
            total_rows = parquet_file.metadata.num_rows

            print(
                f"Testing with real parquet file: {file_size} bytes, {total_rows} rows"
            )

            result = self.reader._read_parquet_in_batches(parquet_file)
            fallback_method_result = dataframe_to_chunks(
                parquet_file.read().to_pandas()
            )
            result_processed_rows = sum(len(chunk) for chunk in result)
            fallback_method_processed_rows = sum(
                len(chunk) for chunk in fallback_method_result
            )

            self.assertEqual(result_processed_rows, fallback_method_processed_rows)

        except Exception as e:
            self.fail(f"Real parquet file test failed: {e}")


if __name__ == "__main__":
    unittest.main()
