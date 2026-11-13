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

from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.readers.dataframe.mf4 import MF4DataFrameReader
from metadata.readers.dataframe.models import DatalakeColumnWrapper


def test_local_mf4_reading_with_installed_asammdf():
    from asammdf import MDF

    from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
        LocalConfig,
    )

    with TemporaryDirectory() as tmp_dir:
        file_path = Path(tmp_dir) / "empty.mf4"
        with MDF(version="4.10") as mdf:
            mdf.save(file_path)

        reader = MF4DataFrameReader(LocalConfig(), None)
        result = reader._read(key=str(file_path), bucket_name="")

    assert list(result.dataframes()) == []


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

        self.reader = MF4DataFrameReader(config_source=mock_config_source, client=mock_client)
        self.mock_reader = mock_reader

    def test_extract_schema_from_header_with_common_properties(self):
        mock_mdf = MagicMock()
        mock_header = MagicMock()
        expected_common_props = {
            "measurement_id": "TEST_001",
            "vehicle_id": "VEH_123",
        }
        mock_header._common_properties = expected_common_props
        mock_mdf.header = mock_header

        result = MF4DataFrameReader._extract_header_from_mdf(mock_mdf)
        self.assertIsInstance(result, DatalakeColumnWrapper)
        self.assertIsNotNone(result.dataframes)
        self.assertIsNotNone(result.dataframes())
        self.assertEqual(result.raw_data, expected_common_props)

    def test_extract_schema_from_header_without_common_properties(self):
        mock_mdf = MagicMock()
        mock_header = MagicMock()
        del mock_header._common_properties
        mock_mdf.header = mock_header

        result = MF4DataFrameReader._extract_header_from_mdf(mock_mdf)

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.dataframes)
        chunks = list(result.dataframes())
        self.assertEqual(len(chunks), 0)

    @patch("asammdf.MDF")
    def test_local_mf4_reading(self, mock_mdf_class):
        mock_mdf = MagicMock()
        mock_header = MagicMock()
        mock_header._common_properties = {"test_key": "test_value"}
        mock_mdf.header = mock_header
        mock_mdf_class.return_value = mock_mdf

        from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
            LocalConfig,
        )

        config = LocalConfig()
        reader = MF4DataFrameReader(config, None)

        result = reader._read(key="test.mf4", bucket_name="")

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.dataframes)
        self.assertIsNotNone(result.dataframes())

    @patch("asammdf.MDF")
    @patch("tempfile.NamedTemporaryFile")
    def test_s3_mf4_reading(self, mock_temp, mock_mdf_class):
        from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
            S3Config,
        )
        from metadata.generated.schema.security.credentials.awsCredentials import (
            AWSCredentials,
        )

        mock_tmp = MagicMock()
        mock_tmp.name = "/tmp/test.mf4"
        mock_temp.return_value.__enter__.return_value = mock_tmp

        mock_mdf = MagicMock()
        mock_header = MagicMock()
        mock_header._common_properties = {"measurement_id": "TEST"}
        mock_mdf.header = mock_header
        mock_mdf_class.return_value = mock_mdf

        mock_client = MagicMock()
        mock_body = MagicMock()
        mock_body.iter_chunks.return_value = [b"chunk1", b"chunk2"]
        mock_client.get_object.return_value = {"Body": mock_body}

        config = S3Config(
            securityConfig=AWSCredentials(awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1")
        )
        reader = MF4DataFrameReader(config, mock_client)

        result = reader._read(key="test.mf4", bucket_name="test-bucket")

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)

    @patch("asammdf.MDF")
    @patch("gcsfs.GCSFileSystem")
    @patch("tempfile.NamedTemporaryFile")
    def test_gcs_mf4_reading(self, mock_temp, mock_gcsfs, mock_mdf_class):
        from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
            GCSConfig,
        )

        mock_tmp = MagicMock()
        mock_tmp.name = "/tmp/test.mf4"
        mock_temp.return_value.__enter__.return_value = mock_tmp

        mock_gcs = MagicMock()
        mock_gcsfs.return_value = mock_gcs

        mock_mdf = MagicMock()
        mock_header = MagicMock()
        mock_header._common_properties = {"vehicle_id": "VEH_123"}
        mock_mdf.header = mock_header
        mock_mdf_class.return_value = mock_mdf

        config = GCSConfig()
        reader = MF4DataFrameReader(config, None)

        result = reader._read(key="test.mf4", bucket_name="test-bucket")

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)

    @patch("asammdf.MDF")
    @patch("adlfs.AzureBlobFileSystem")
    @patch("metadata.readers.dataframe.mf4.return_azure_storage_options")
    @patch("tempfile.NamedTemporaryFile")
    def test_azure_mf4_reading(self, mock_temp, mock_storage_opts, mock_adlfs, mock_mdf_class):
        from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
            AzureConfig,
        )
        from metadata.generated.schema.security.credentials.azureCredentials import (
            AzureCredentials,
        )

        mock_tmp = MagicMock()
        mock_tmp.name = "/tmp/test.mf4"
        mock_temp.return_value.__enter__.return_value = mock_tmp

        mock_storage_opts.return_value = {"connection_string": "test"}
        mock_fs = MagicMock()
        mock_adlfs.return_value = mock_fs

        mock_mdf = MagicMock()
        mock_header = MagicMock()
        mock_header._common_properties = {"test_date": "2025-01-01"}
        mock_mdf.header = mock_header
        mock_mdf_class.return_value = mock_mdf

        config = AzureConfig(securityConfig=AzureCredentials(accountName="test", clientId="test", tenantId="test"))
        reader = MF4DataFrameReader(config, None)

        result = reader._read(key="test.mf4", bucket_name="test-container")

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)


class TestAzureSovereignMF4Reader:
    @patch("asammdf.MDF")
    @patch("adlfs.AzureBlobFileSystem")
    def test_azure_us_gov_mf4_strips_account_name_and_uses_sovereign_options(self, mock_adlfs, mock_mdf_class):
        from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
            AzureConfig,
        )
        from metadata.generated.schema.security.credentials.azureCredentials import (
            AzureCredentials,
        )

        mock_fs = MagicMock()
        mock_adlfs.return_value = mock_fs
        mock_mdf = MagicMock()
        mock_mdf.header._common_properties = {"vehicle_id": "GOV_VEH_01"}
        mock_mdf_class.return_value = mock_mdf

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="  govmf4acct  ",
                clientId="gov-client",
                clientSecret="gov-secret",
                tenantId="11111111-2222-3333-4444-555555555555",
                endpointSuffix="core.usgovcloudapi.net",
            )
        )
        reader = MF4DataFrameReader(config, None)
        result = reader._read(key="drive/run01.mf4", bucket_name="$root")
        chunks = list(result.dataframes())

        assert len(chunks) == 1
        fs_kwargs = mock_adlfs.call_args.kwargs
        assert fs_kwargs["account_name"] == "govmf4acct"
        assert fs_kwargs["account_host"] == "govmf4acct.blob.core.usgovcloudapi.net"
        assert fs_kwargs["credential"]._authority == "https://login.microsoftonline.us"
        assert mock_fs.get.call_args.args[0] == "$root/drive/run01.mf4"

    def test_azure_mf4_missing_security_config_and_missing_account_name_raise(self):
        import pytest

        from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
            AzureConfig,
        )
        from metadata.generated.schema.security.credentials.azureCredentials import (
            AzureCredentials,
        )
        from metadata.readers.dataframe.base import DataFrameReadException

        missing_sec_reader = MF4DataFrameReader(AzureConfig(securityConfig=None), None)
        with pytest.raises(ValueError, match="Azure securityConfig is required"):
            missing_sec_reader._read(key="run01.mf4", bucket_name="container")
        with pytest.raises(DataFrameReadException, match="Azure securityConfig is required"):
            missing_sec_reader.read(key="run01.mf4", bucket_name="container")

        missing_acct_reader = MF4DataFrameReader(
            AzureConfig(
                securityConfig=AzureCredentials(
                    accountName=None,
                    clientId="cid",
                    clientSecret="sec",
                    tenantId="11111111-2222-3333-4444-555555555555",
                )
            ),
            None,
        )
        with pytest.raises(ValueError, match="Account Name is required"):
            missing_acct_reader._read(key="run01.mf4", bucket_name="container")
