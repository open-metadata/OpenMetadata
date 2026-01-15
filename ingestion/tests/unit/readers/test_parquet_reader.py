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

            dataframes = result.dataframes() if callable(result.dataframes) else result.dataframes
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

        dataframes = result.dataframes() if callable(result.dataframes) else result.dataframes
        chunks = list(dataframes)
        self.assertTrue(len(chunks) > 0)

    @patch("pyarrow.fs.S3FileSystem")
    @patch("pyarrow.parquet.ParquetDataset")
    def test_s3_small_parquet_file(self, mock_dataset, mock_s3fs):
        mock_fs = Mock()
        mock_s3fs.return_value = mock_fs

        mock_file_info = Mock()
        mock_file_info.size = 1000
        mock_fs.get_file_info.return_value = mock_file_info

        mock_table = Mock()
        mock_df = pd.DataFrame({"id": [1], "name": ["Test"]})
        mock_table.to_pandas.return_value = mock_df

        mock_ds = Mock()
        mock_ds.read_pandas.return_value = mock_table
        mock_dataset.return_value = mock_ds

        config = S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
        )
        reader = ParquetDataFrameReader(config, None)

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        dataframes = result.dataframes() if callable(result.dataframes) else result.dataframes
        chunks = list(dataframes)
        self.assertTrue(len(chunks) > 0)

    @patch("pyarrow.fs.S3FileSystem")
    @patch("pyarrow.parquet.ParquetFile")
    def test_s3_large_parquet_file_chunking(self, mock_parquet_file, mock_s3fs):
        mock_fs = Mock()
        mock_s3fs.return_value = mock_fs

        mock_file_info = Mock()
        mock_file_info.size = MAX_FILE_SIZE_FOR_PREVIEW + 1000
        mock_fs.get_file_info.return_value = mock_file_info

        mock_pf = Mock()
        mock_parquet_file.return_value = mock_pf

        batch_data = pd.DataFrame({"id": [1], "name": ["Test"]})
        mock_batch = Mock()
        mock_batch.to_pandas.return_value = batch_data

        mock_pf.iter_batches = Mock(return_value=iter([mock_batch]))

        config = S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
        )
        reader = ParquetDataFrameReader(config, None)

        result = reader._read(key="test.parquet", bucket_name="test-bucket")

        dataframes = result.dataframes() if callable(result.dataframes) else result.dataframes
        chunks = list(dataframes)
        self.assertTrue(len(chunks) > 0)

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

        dataframes = result.dataframes() if callable(result.dataframes) else result.dataframes
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

        dataframes = result.dataframes() if callable(result.dataframes) else result.dataframes
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
