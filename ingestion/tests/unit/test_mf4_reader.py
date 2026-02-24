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
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
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
    def test_azure_mf4_reading(
        self, mock_temp, mock_storage_opts, mock_adlfs, mock_mdf_class
    ):
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

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="test", clientId="test", tenantId="test"
            )
        )
        reader = MF4DataFrameReader(config, None)

        result = reader._read(key="test.mf4", bucket_name="test-container")

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
