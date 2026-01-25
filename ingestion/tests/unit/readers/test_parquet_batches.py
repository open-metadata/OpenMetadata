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
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        batch1_data = pd.DataFrame(
            {"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"], "age": [25, 30, 35]}
        )
        batch2_data = pd.DataFrame(
            {"id": [4, 5], "name": ["David", "Eve"], "age": [40, 45]}
        )

        mock_batch1 = Mock()
        mock_batch1.to_pandas.return_value = batch1_data
        mock_batch2 = Mock()
        mock_batch2.to_pandas.return_value = batch2_data

        mock_parquet_file.iter_batches.return_value = iter([mock_batch1, mock_batch2])

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.side_effect = lambda df: [df] if not df.empty else []

            result = list(
                self.reader._read_parquet_in_batches(mock_parquet_file, batch_size=1000)
            )

            mock_parquet_file.iter_batches.assert_called_once_with(batch_size=1000)

            self.assertEqual(mock_chunks.call_count, 2)

            self.assertEqual(len(result), 2)
            pd.testing.assert_frame_equal(result[0], batch1_data)
            pd.testing.assert_frame_equal(result[1], batch2_data)

    def test_batch_reading_with_empty_batches(self):
        """Test that empty batches are properly skipped"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

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

            result = list(self.reader._read_parquet_in_batches(mock_parquet_file))

            mock_chunks.assert_called_once_with(non_empty_batch)

            self.assertEqual(len(result), 1)
            pd.testing.assert_frame_equal(result[0], non_empty_batch)

    def test_exception_handling_with_successful_fallback(self):
        """Test exception handling when batching fails but fallback succeeds"""
        mock_parquet_file = Mock(spec=["read"])

        sample_data = pd.DataFrame({"id": [1, 2], "name": ["Alice", "Bob"]})
        mock_arrow_table = Mock()
        mock_arrow_table.to_pandas.return_value = sample_data
        mock_parquet_file.read.return_value = mock_arrow_table

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.return_value = [sample_data]

            with patch("metadata.readers.dataframe.parquet.logger") as mock_logger:
                result = list(self.reader._read_parquet_in_batches(mock_parquet_file))

                mock_logger.warning.assert_called_with(
                    "No chunking methods available, falling back to regular reading"
                )

                mock_parquet_file.read.assert_called_once()

                self.assertEqual(result, [sample_data])

    def test_exception_handling_with_failed_fallback(self):
        """Test when both batching and fallback fail"""
        mock_parquet_file = Mock(spec=["read"])
        mock_parquet_file.read.side_effect = Exception("Regular read failed")

        with patch("metadata.readers.dataframe.parquet.logger") as mock_logger:
            with self.assertRaises(Exception) as context:
                list(self.reader._read_parquet_in_batches(mock_parquet_file))

            self.assertEqual(str(context.exception), "Regular read failed")

            mock_logger.error.assert_called_with(
                "Failed to read parquet file: Regular read failed"
            )

    def test_custom_batch_size(self):
        """Test that custom batch size is properly passed to iter_batches"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        batch_data = pd.DataFrame({"id": [1], "name": ["Alice"]})
        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data

        mock_parquet_file.iter_batches.return_value = iter([mock_batch])

        with patch(
            "metadata.readers.dataframe.parquet.dataframe_to_chunks"
        ) as mock_chunks:
            mock_chunks.return_value = [batch_data]

            custom_batch_size = 5000
            list(
                self.reader._read_parquet_in_batches(
                    mock_parquet_file, batch_size=custom_batch_size
                )
            )

            mock_parquet_file.iter_batches.assert_called_once_with(
                batch_size=custom_batch_size
            )

    def test_batch_counting_and_logging(self):
        """Test that batch counting and logging work correctly"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

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
                result = list(self.reader._read_parquet_in_batches(mock_parquet_file))

                mock_logger.info.assert_any_call(
                    "Reading large parquet file in batches to avoid memory issues"
                )
                mock_logger.info.assert_any_call(
                    "Successfully processed 3 batches from large parquet file"
                )

                self.assertEqual(len(result), 3)

    def test_dataframe_to_chunks_integration(self):
        """Test integration with dataframe_to_chunks function"""
        mock_parquet_file = Mock()
        mock_parquet_file.iter_batches = Mock()

        batch_data = pd.DataFrame(
            {
                "id": list(range(1000)),
                "name": [f"User{i}" for i in range(1000)],
            }
        )

        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data
        mock_parquet_file.iter_batches.return_value = iter([mock_batch])

        result = list(self.reader._read_parquet_in_batches(mock_parquet_file))

        self.assertIsInstance(result, list)
        self.assertTrue(len(result) > 0)

        for chunk in result:
            self.assertIsInstance(chunk, pd.DataFrame)

        if len(result) > 1:
            concatenated = pd.concat(result, ignore_index=True)
            pd.testing.assert_frame_equal(concatenated, batch_data)
        else:
            pd.testing.assert_frame_equal(result[0], batch_data)

    def test_real_parquet_file_batch_processing(self):
        """Test batch processing with real flights-1m.parquet file (7MB)"""
        import os

        from pyarrow.parquet import ParquetFile

        test_file_path = os.path.join(
            os.path.dirname(__file__), "test_files", "flights-1m.parquet"
        )

        if not os.path.exists(test_file_path):
            self.skipTest(f"Test file not found: {test_file_path}")

        try:
            parquet_file = ParquetFile(test_file_path)

            file_size = os.path.getsize(test_file_path)
            total_rows = parquet_file.metadata.num_rows

            print(
                f"Testing with real parquet file: {file_size} bytes, {total_rows} rows"
            )

            result = list(self.reader._read_parquet_in_batches(parquet_file))
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
