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
from unittest.mock import MagicMock, Mock, patch

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

        batch1_data = pd.DataFrame({"id": [1, 2, 3], "name": ["Alice", "Bob", "Charlie"], "age": [25, 30, 35]})
        batch2_data = pd.DataFrame({"id": [4, 5], "name": ["David", "Eve"], "age": [40, 45]})

        mock_batch1 = Mock()
        mock_batch1.to_pandas.return_value = batch1_data
        mock_batch2 = Mock()
        mock_batch2.to_pandas.return_value = batch2_data

        mock_pf.iter_batches = Mock(return_value=iter([mock_batch1, mock_batch2]))

        result = self.reader._read(key=self.key, bucket_name=self.bucket_name)

        mock_azure_fs.assert_called_once_with(account_name="teststorageaccount", connection_string="test-connection")
        mock_adlfs.info.assert_called_once_with(f"{self.bucket_name}/{self.key}")

        # Consume the generator to trigger the lazy reading
        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)

        # Now check that the mocks were called after generator consumption
        mock_fsspec_handler.assert_called_once_with(mock_adlfs)
        mock_pyfilesystem.assert_called_once_with(mock_handler)
        mock_parquet_file.assert_called_once_with(f"{self.bucket_name}/{self.key}", filesystem=mock_fs)

        self.assertTrue(len(chunks) > 0)

    @patch("adlfs.AzureBlobFileSystem")
    @patch("metadata.readers.dataframe.parquet.return_azure_storage_options")
    @patch("pandas.read_parquet")
    def test_azure_small_file_regular_reading(self, mock_read_parquet, mock_storage_options, mock_azure_fs):
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

        mock_azure_fs.assert_called_once_with(account_name="teststorageaccount", connection_string="test-connection")

        # Consume the generator to trigger the lazy reading
        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)

        expected_account_url = f"abfs://{self.bucket_name}@teststorageaccount.dfs.core.windows.net/{self.key}"
        mock_read_parquet.assert_called_once_with(
            expected_account_url,
            storage_options={"connection_string": "test-connection"},
        )

        self.assertTrue(len(chunks) > 0)

    def test_should_use_chunking_logic(self):
        """Test the _should_use_chunking method logic"""
        self.assertTrue(self.reader._should_use_chunking(MAX_FILE_SIZE_FOR_PREVIEW + 1))

        self.assertFalse(self.reader._should_use_chunking(MAX_FILE_SIZE_FOR_PREVIEW - 1))

        self.assertTrue(self.reader._should_use_chunking(0))


class TestAzureSovereignParquetReader:
    @patch("pandas.read_parquet")
    @patch("adlfs.AzureBlobFileSystem")
    def test_us_gov_small_file_uses_gov_abfs_url_and_account_host(self, mock_azure_fs, mock_read_parquet):
        gov_credentials = AzureCredentials(
            accountName="govstorageacct",
            clientId="gov-client-id",
            clientSecret="gov-secret",
            tenantId="11111111-2222-3333-4444-555555555555",
            endpointSuffix="core.usgovcloudapi.net",
        )
        reader = ParquetDataFrameReader(AzureConfig(securityConfig=gov_credentials), None)

        mock_adlfs = Mock()
        mock_adlfs.info.return_value = {
            "size": MAX_FILE_SIZE_FOR_PREVIEW - 1000,
            "type": "file",
        }
        mock_azure_fs.return_value = mock_adlfs
        mock_read_parquet.return_value = pd.DataFrame({"id": [1], "name": ["Gov"]})

        result = reader._read(key="gov/data.parquet", bucket_name="gov-container")
        chunks = list(result.dataframes())

        assert len(chunks) == 1
        fs_kwargs = mock_azure_fs.call_args.kwargs
        assert fs_kwargs["account_name"] == "govstorageacct"
        assert fs_kwargs["account_host"] == "govstorageacct.blob.core.usgovcloudapi.net"
        assert fs_kwargs["credential"]._authority == "https://login.microsoftonline.us"

        read_args, read_kwargs = mock_read_parquet.call_args
        assert read_args[0] == "abfs://gov-container@govstorageacct.dfs.core.usgovcloudapi.net/gov/data.parquet"
        assert read_kwargs["storage_options"]["account_host"] == "govstorageacct.blob.core.usgovcloudapi.net"
        assert read_kwargs["storage_options"]["account_name"] == "govstorageacct"
        assert read_kwargs["storage_options"]["credential"]._authority == "https://login.microsoftonline.us"

    @patch("pandas.read_parquet")
    @patch("adlfs.AzureBlobFileSystem")
    def test_us_gov_info_failure_falls_back_to_pandas_with_gov_options(self, mock_azure_fs, mock_read_parquet):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="govstorageacct",
                clientId="gov-client-id",
                clientSecret="gov-secret",
                tenantId="11111111-2222-3333-4444-555555555555",
                endpointSuffix="core.usgovcloudapi.net",
            )
        )
        reader = ParquetDataFrameReader(config_source=config, client=None)

        mock_adlfs = MagicMock()
        mock_adlfs.info.side_effect = PermissionError("HEAD forbidden")
        mock_azure_fs.return_value = mock_adlfs
        mock_read_parquet.return_value = pd.DataFrame({"id": [1], "name": ["Fallback"]})

        result = reader._read(key="gov/fallback.parquet", bucket_name="gov-container")
        chunks = list(result.dataframes())

        assert len(chunks) == 1
        fs_kwargs = mock_azure_fs.call_args.kwargs
        assert fs_kwargs["account_name"] == "govstorageacct"
        assert fs_kwargs["account_host"] == "govstorageacct.blob.core.usgovcloudapi.net"
        assert fs_kwargs["credential"]._authority == "https://login.microsoftonline.us"

        read_args, read_kwargs = mock_read_parquet.call_args
        assert read_args[0] == "abfs://gov-container@govstorageacct.dfs.core.usgovcloudapi.net/gov/fallback.parquet"
        assert read_kwargs["storage_options"]["account_host"] == "govstorageacct.blob.core.usgovcloudapi.net"
        assert read_kwargs["storage_options"]["account_name"] == "govstorageacct"
        assert read_kwargs["storage_options"]["credential"]._authority == "https://login.microsoftonline.us"

    @patch("pyarrow.parquet.ParquetFile")
    @patch("pyarrow.fs.FSSpecHandler")
    @patch("pyarrow.fs.PyFileSystem")
    @patch("adlfs.AzureBlobFileSystem")
    def test_us_gov_large_file_uses_batched_arrow_reader(
        self, mock_azure_fs, mock_py_fs, mock_fsspec_handler, mock_parquet_file
    ):
        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="  govstorageacct  ",
                clientId="gov-client-id",
                clientSecret="gov-secret",
                tenantId="11111111-2222-3333-4444-555555555555",
                endpointSuffix="core.usgovcloudapi.net",
            )
        )
        reader = ParquetDataFrameReader(config_source=config, client=None)

        mock_adlfs = MagicMock()
        mock_adlfs.info.return_value = {
            "size": MAX_FILE_SIZE_FOR_PREVIEW + 2048,
            "type": "file",
        }
        mock_azure_fs.return_value = mock_adlfs

        mock_batch = MagicMock()
        mock_batch.to_pandas.return_value = pd.DataFrame({"id": [1, 2]})
        mock_pf = MagicMock()
        mock_pf.iter_batches.return_value = [mock_batch]
        mock_parquet_file.return_value = mock_pf

        result = reader._read(key="gov/large.parquet", bucket_name="$web")
        chunks = list(result.dataframes())

        assert len(chunks) == 1
        fs_kwargs = mock_azure_fs.call_args.kwargs
        assert fs_kwargs["account_name"] == "govstorageacct"
        assert fs_kwargs["account_host"] == "govstorageacct.blob.core.usgovcloudapi.net"
        assert fs_kwargs["credential"]._authority == "https://login.microsoftonline.us"
        mock_fsspec_handler.assert_called_once_with(mock_adlfs)
        mock_py_fs.assert_called_once()
        mock_parquet_file.assert_called_once_with("$web/gov/large.parquet", filesystem=mock_py_fs.return_value)

    def test_azure_missing_security_config_raises(self):
        import pytest

        reader = ParquetDataFrameReader(config_source=AzureConfig(securityConfig=None), client=None)
        with pytest.raises(ValueError, match="Azure securityConfig is required"):
            reader._read(key="gov/data.parquet", bucket_name="gov-container")


class TestParquetFallbackPaths:
    def test_row_group_fallback_and_local_gcs_fallbacks(self, tmp_path):
        import pyarrow as pa
        import pytest

        from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
            GCSConfig,
        )
        from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
            LocalConfig,
        )
        from metadata.generated.schema.security.credentials.gcpCredentials import (
            GcpADC,
            GCPCredentials,
        )
        from metadata.readers.dataframe.base import FileFormatException

        reader = ParquetDataFrameReader(config_source=LocalConfig(), client=None)

        class RowGroupOnlyParquet:
            num_row_groups = 2

            def read_row_group(self, idx: int):
                if idx == 0:
                    raise RuntimeError("corrupt row group 0")
                return pa.Table.from_pandas(pd.DataFrame({"id": [1, 2, 3]}))

        chunks = list(reader._read_parquet_in_batches(RowGroupOnlyParquet(), batch_size=2))
        assert sum(len(c) for c in chunks) == 3

        missing_parquet = str(tmp_path / "nonexistent.parquet")
        with (
            patch("os.path.getsize", side_effect=OSError("stat failed")),
            patch("pandas.read_parquet", return_value=pd.DataFrame({"id": [10]})) as mock_local_read,
        ):
            local_res = reader._read(key=missing_parquet, bucket_name="")
            local_chunks = list(local_res.dataframes())
            assert len(local_chunks) == 1
            mock_local_read.assert_called_once_with(missing_parquet)

        gcs_config = GCSConfig(securityConfig=GCPCredentials(gcpConfig=GcpADC()))
        gcs_reader = ParquetDataFrameReader(config_source=gcs_config, client=None)
        mock_gcs = MagicMock()
        mock_gcs.info.side_effect = OSError("gcs info error")
        mock_pf = MagicMock()
        mock_pf.read.return_value.to_pandas.return_value = pd.DataFrame({"id": [99]})
        with (
            patch("gcsfs.GCSFileSystem", return_value=mock_gcs),
            patch("pyarrow.parquet.ParquetFile", return_value=mock_pf),
        ):
            gcs_res = gcs_reader._read(key="folder/data.parquet", bucket_name="gcs-bkt")
            gcs_chunks = list(gcs_res.dataframes())
            assert len(gcs_chunks) == 1

        with pytest.raises(FileFormatException):
            reader._read_parquet_dispatch(object(), "x.parquet", "bkt")  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()
