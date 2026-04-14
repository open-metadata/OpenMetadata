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
Tests for ParquetDataFrameReader S3, GCS, and Local
"""
import tempfile
import unittest
from unittest.mock import Mock, patch

import pandas as pd

from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.readers.dataframe.base import MAX_FILE_SIZE_FOR_PREVIEW
from metadata.readers.dataframe.parquet import ParquetDataFrameReader


class TestParquetReader(unittest.TestCase):
    def test_local_small_parquet_file(self):
        df = pd.DataFrame({"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"]})

        with tempfile.NamedTemporaryFile(suffix=".parquet", delete=False) as tmp:
            df.to_parquet(tmp.name)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = ParquetDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertTrue(len(chunks) > 0)
            total_rows = sum(len(chunk) for chunk in chunks)
            self.assertEqual(total_rows, 3)
        finally:
            import os

            os.unlink(tmp_path)

    @patch("pyarrow.parquet.ParquetFile")
    @patch("os.path.getsize")
    def test_local_large_parquet_file_chunking(self, mock_getsize, mock_parquet_file):
        mock_getsize.return_value = MAX_FILE_SIZE_FOR_PREVIEW + 1000

        mock_pf = Mock()
        mock_parquet_file.return_value = mock_pf

        batch1_data = pd.DataFrame({"id": [1, 2], "name": ["Alice", "Bob"]})
        batch2_data = pd.DataFrame({"id": [3], "name": ["Charlie"]})

        mock_batch1 = Mock()
        mock_batch1.to_pandas.return_value = batch1_data
        mock_batch2 = Mock()
        mock_batch2.to_pandas.return_value = batch2_data

        mock_pf.iter_batches = Mock(return_value=iter([mock_batch1, mock_batch2]))

        config = LocalConfig()
        reader = ParquetDataFrameReader(config, None)

        result = reader._read(key="test.parquet", bucket_name="")

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)
        self.assertTrue(len(chunks) > 0)

    def _create_s3_reader(self):
        """Helper to create an S3 ParquetDataFrameReader with a mocked boto3 client."""
        config = S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
        )
        mock_client = Mock()
        reader = ParquetDataFrameReader(config, mock_client)
        return reader, mock_client

    def _mock_s3_response(self, mock_client, parquet_bytes):
        """Helper to mock a boto3 get_object response with parquet data."""
        mock_body = Mock()
        mock_body.read.return_value = parquet_bytes
        mock_client.get_object.return_value = {"Body": mock_body}

    def test_s3_small_parquet_file(self):
        """Test S3 parquet reading uses boto3 client.get_object for small files."""
        reader, mock_client = self._create_s3_reader()

        df = pd.DataFrame({"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"]})
        parquet_bytes = df.to_parquet()
        self._mock_s3_response(mock_client, parquet_bytes)

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        chunks = list(result.dataframes())
        self.assertTrue(len(chunks) > 0)

        total_rows = sum(len(chunk) for chunk in chunks)
        self.assertEqual(total_rows, 3)

        mock_client.get_object.assert_called_once_with(
            Bucket="test-bucket", Key="test.parquet"
        )

    @patch("pyarrow.parquet.ParquetFile")
    def test_s3_large_parquet_file_chunking(self, mock_parquet_file_cls):
        """Test S3 large parquet file triggers batched reading via boto3 client."""
        reader, mock_client = self._create_s3_reader()

        large_content = b"\x00" * (MAX_FILE_SIZE_FOR_PREVIEW + 1000)
        self._mock_s3_response(mock_client, large_content)

        mock_pf = Mock()
        mock_parquet_file_cls.return_value = mock_pf

        batch_data = pd.DataFrame({"id": [1], "name": ["Test"]})
        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data
        mock_pf.iter_batches = Mock(return_value=iter([mock_batch]))

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        chunks = list(result.dataframes())
        self.assertTrue(len(chunks) > 0)

        mock_client.get_object.assert_called_once_with(
            Bucket="test-bucket", Key="test.parquet"
        )

    def test_s3_get_object_error_propagates(self):
        """Test that boto3 client errors propagate correctly."""
        from botocore.exceptions import ClientError

        reader, mock_client = self._create_s3_reader()

        mock_client.get_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "GetObject",
        )

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        with self.assertRaises(ClientError):
            list(result.dataframes())

    def test_s3_response_body_closed(self):
        """Test that the S3 response body is always closed, even on error."""
        reader, mock_client = self._create_s3_reader()

        mock_body = Mock()
        mock_body.read.side_effect = Exception("network error")
        mock_client.get_object.return_value = {"Body": mock_body}

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        with self.assertRaises(Exception):
            list(result.dataframes())

        mock_body.close.assert_called_once()

    @patch("gcsfs.GCSFileSystem")
    @patch("pyarrow.parquet.ParquetFile")
    def test_gcs_small_parquet_file(self, mock_parquet_file, mock_gcsfs):
        mock_gcs = Mock()
        mock_gcsfs.return_value = mock_gcs

        mock_gcs.info.return_value = {"size": 1000}

        mock_pf = Mock()
        mock_parquet_file.return_value = mock_pf

        mock_table = Mock()
        mock_df = pd.DataFrame({"id": [1], "name": ["Test"]})
        mock_table.to_pandas.return_value = mock_df
        mock_pf.read.return_value = mock_table

        config = GCSConfig()
        reader = ParquetDataFrameReader(config, None)

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)
        self.assertTrue(len(chunks) > 0)

    @patch("gcsfs.GCSFileSystem")
    @patch("pyarrow.parquet.ParquetFile")
    def test_gcs_large_parquet_file_chunking(self, mock_parquet_file, mock_gcsfs):
        mock_gcs = Mock()
        mock_gcsfs.return_value = mock_gcs

        mock_gcs.info.return_value = {"size": MAX_FILE_SIZE_FOR_PREVIEW + 1000}

        mock_pf = Mock()
        mock_parquet_file.return_value = mock_pf

        batch_data = pd.DataFrame({"id": [1], "name": ["Test"]})
        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data

        mock_pf.iter_batches = Mock(return_value=iter([mock_batch]))

        config = GCSConfig()
        reader = ParquetDataFrameReader(config, None)

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)
        self.assertTrue(len(chunks) > 0)

    def test_should_use_chunking_logic(self):
        config = LocalConfig()
        reader = ParquetDataFrameReader(config, None)

        self.assertTrue(reader._should_use_chunking(MAX_FILE_SIZE_FOR_PREVIEW + 1))
        self.assertFalse(reader._should_use_chunking(MAX_FILE_SIZE_FOR_PREVIEW - 1))
        self.assertTrue(reader._should_use_chunking(0))


if __name__ == "__main__":
    unittest.main()
