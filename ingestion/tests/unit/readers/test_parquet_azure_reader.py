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
Tests for ParquetDataFrameReader Azure-specific functionality
"""
import unittest
from unittest.mock import Mock, patch

import pandas as pd

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.readers.dataframe.base import MAX_FILE_SIZE_FOR_PREVIEW
from metadata.readers.dataframe.parquet import ParquetDataFrameReader


class TestAzureParquetReader(unittest.TestCase):
    """
    Test Azure-specific parquet reading functionality with chunking support
    """

    def setUp(self):
        """Set up test fixtures"""
        self.azure_credentials = AzureCredentials(
            accountName="teststorageaccount",
            clientId="test-client-id",
            tenantId="test-tenant-id",
        )
        self.config_source = AzureConfig(securityConfig=self.azure_credentials)
        self.reader = ParquetDataFrameReader(self.config_source, None)
        self.bucket_name = "test-container"
        self.key = "test-folder/test-file.parquet"

    @patch("adlfs.AzureBlobFileSystem")
    @patch("metadata.readers.dataframe.parquet.return_azure_storage_options")
    @patch("pyarrow.parquet.ParquetFile")
    @patch("pyarrow.fs.PyFileSystem")
    @patch("pyarrow.fs.FSSpecHandler")
    def test_azure_large_file_chunking(
        self,
        mock_fsspec_handler,
        mock_pyfilesystem,
        mock_parquet_file,
        mock_storage_options,
        mock_azure_fs,
    ):
        """Test Azure parquet reading with chunking for large files"""
        mock_storage_options.return_value = {"connection_string": "test-connection"}

        mock_adlfs = Mock()
        mock_azure_fs.return_value = mock_adlfs
        mock_adlfs.info.return_value = {
            "size": MAX_FILE_SIZE_FOR_PREVIEW + 1000,
            "type": "file",
        }

        mock_handler = Mock()
        mock_fsspec_handler.return_value = mock_handler
        mock_fs = Mock()
        mock_pyfilesystem.return_value = mock_fs

        mock_pf = Mock()
        mock_parquet_file.return_value = mock_pf

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

        mock_pf.iter_batches = Mock(return_value=iter([mock_batch1, mock_batch2]))

        result = self.reader._read(key=self.key, bucket_name=self.bucket_name)

        mock_azure_fs.assert_called_once_with(
            account_name="teststorageaccount", connection_string="test-connection"
        )
        mock_adlfs.info.assert_called_once_with(f"{self.bucket_name}/{self.key}")

        mock_fsspec_handler.assert_called_once_with(mock_adlfs)
        mock_pyfilesystem.assert_called_once_with(mock_handler)
        mock_parquet_file.assert_called_once_with(
            f"{self.bucket_name}/{self.key}", filesystem=mock_fs
        )

        self.assertIsNotNone(result.dataframes)
        self.assertEqual(len(result.dataframes), 2)

    @patch("adlfs.AzureBlobFileSystem")
    @patch("metadata.readers.dataframe.parquet.return_azure_storage_options")
    @patch("pandas.read_parquet")
    def test_azure_small_file_regular_reading(
        self, mock_read_parquet, mock_storage_options, mock_azure_fs
    ):
        """Test Azure parquet reading without chunking for small files"""
        mock_storage_options.return_value = {"connection_string": "test-connection"}

        mock_adlfs = Mock()
        mock_azure_fs.return_value = mock_adlfs
        mock_adlfs.info.return_value = {
            "size": MAX_FILE_SIZE_FOR_PREVIEW - 1000,
            "type": "file",
        }

        sample_data = pd.DataFrame({"id": [1, 2], "name": ["Alice", "Bob"]})
        mock_read_parquet.return_value = sample_data

        result = self.reader._read(key=self.key, bucket_name=self.bucket_name)

        mock_azure_fs.assert_called_once_with(
            account_name="teststorageaccount", connection_string="test-connection"
        )

        expected_account_url = (
            f"abfs://{self.bucket_name}@teststorageaccount.dfs.core.windows.net/"
            f"{self.key}"
        )
        mock_read_parquet.assert_called_once_with(
            expected_account_url,
            storage_options={"connection_string": "test-connection"},
        )

        self.assertIsNotNone(result.dataframes)

    def test_should_use_chunking_logic(self):
        """Test the _should_use_chunking method logic"""
        self.assertTrue(self.reader._should_use_chunking(MAX_FILE_SIZE_FOR_PREVIEW + 1))

        self.assertFalse(
            self.reader._should_use_chunking(MAX_FILE_SIZE_FOR_PREVIEW - 1)
        )

        self.assertTrue(self.reader._should_use_chunking(0))


if __name__ == "__main__":
    unittest.main()
