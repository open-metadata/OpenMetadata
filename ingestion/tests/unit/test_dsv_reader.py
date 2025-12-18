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
DSV (CSV/TSV) reader unit tests
"""
import io
from unittest import TestCase
from unittest.mock import MagicMock, Mock, patch

import pandas as pd

from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
    AzureConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
    GCSConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.readers.dataframe.dsv import (
    CSV_SEPARATOR,
    TSV_SEPARATOR,
    CSVDataFrameReader,
    DSVDataFrameReader,
    TSVDataFrameReader,
)
from metadata.readers.dataframe.models import DatalakeColumnWrapper


class TestDSVDataFrameReader(TestCase):
    """
    Test DSVDataFrameReader functionality
    """

    @patch("metadata.readers.dataframe.base.get_reader")
    def setUp(self, mock_get_reader):
        mock_config_source = MagicMock()
        mock_client = MagicMock()
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        self.reader = DSVDataFrameReader(
            config_source=mock_config_source, client=mock_client
        )
        self.mock_reader = mock_reader
        self.mock_config_source = mock_config_source
        self.mock_client = mock_client

    def test_csv_separator_initialization(self):
        self.assertEqual(self.reader.separator, CSV_SEPARATOR)

    @patch("metadata.readers.dataframe.base.get_reader")
    def test_tsv_separator_initialization(self, mock_get_reader):
        mock_config_source = MagicMock()
        mock_client = MagicMock()
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        tsv_reader = DSVDataFrameReader(
            config_source=mock_config_source,
            client=mock_client,
            separator=TSV_SEPARATOR,
        )

        self.assertEqual(tsv_reader.separator, TSV_SEPARATOR)

    @patch("pandas.read_csv")
    def test_read_from_pandas_basic(self, mock_read_csv):
        mock_df = pd.DataFrame({"col1": [1, 2, 3], "col2": ["a", "b", "c"]})
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = [mock_df]
        mock_context_manager.__exit__ = Mock(return_value=False)
        mock_read_csv.return_value = mock_context_manager

        result = self.reader.read_from_pandas(path="/test/file.csv", max_chunks=5)

        self.assertIsInstance(result, DatalakeColumnWrapper)
        self.assertEqual(len(result.dataframes), 1)
        self.assertEqual(result.dataframes[0].shape, (3, 2))

    @patch("pandas.read_csv")
    def test_read_from_pandas_with_gzip_compression(self, mock_read_csv):
        mock_df = pd.DataFrame({"col1": [1, 2, 3]})
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = [mock_df]
        mock_context_manager.__exit__ = Mock(return_value=False)
        mock_read_csv.return_value = mock_context_manager

        self.reader.read_from_pandas(path="/test/file.csv.gz", max_chunks=5)

        mock_read_csv.assert_called_once()
        call_kwargs = mock_read_csv.call_args[1]
        self.assertEqual(call_kwargs["compression"], "gzip")

    @patch("pandas.read_csv")
    def test_read_from_pandas_max_chunks_limit(self, mock_read_csv):
        mock_dfs = [pd.DataFrame({"col1": [i]}) for i in range(10)]
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = iter(mock_dfs)
        mock_context_manager.__exit__ = Mock(return_value=False)
        mock_read_csv.return_value = mock_context_manager

        result = self.reader.read_from_pandas(path="/test/large.csv", max_chunks=3)

        self.assertEqual(len(result.dataframes), 3)

    @patch("pandas.read_csv")
    def test_read_from_pandas_with_storage_options(self, mock_read_csv):
        mock_df = pd.DataFrame({"col1": [1]})
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = [mock_df]
        mock_context_manager.__exit__ = Mock(return_value=False)
        mock_read_csv.return_value = mock_context_manager

        storage_opts = {"account_name": "test_account"}
        self.reader.read_from_pandas(
            path="abfs://test.csv", storage_options=storage_opts, max_chunks=5
        )

        mock_read_csv.assert_called_once()
        call_kwargs = mock_read_csv.call_args[1]
        self.assertEqual(call_kwargs["storage_options"], storage_opts)

    @patch("metadata.readers.dataframe.base.get_reader")
    def test_gcs_dispatch(self, mock_get_reader):
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        mock_config_source = GCSConfig()
        gcs_reader = DSVDataFrameReader(config_source=mock_config_source, client=None)

        with patch.object(gcs_reader, "read_from_pandas") as mock_read_from_pandas:
            mock_read_from_pandas.return_value = DatalakeColumnWrapper(dataframes=[])

            gcs_reader._read_dsv_dispatch(
                mock_config_source, key="test.csv", bucket_name="test-bucket"
            )

            mock_read_from_pandas.assert_called_once()
            call_kwargs = mock_read_from_pandas.call_args[1]
            self.assertEqual(call_kwargs["path"], "gs://test-bucket/test.csv")
            self.assertIsNone(call_kwargs["compression"])

    @patch("metadata.readers.dataframe.base.get_reader")
    def test_gcs_dispatch_with_gzip(self, mock_get_reader):
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        mock_config_source = GCSConfig()
        gcs_reader = DSVDataFrameReader(config_source=mock_config_source, client=None)

        with patch.object(gcs_reader, "read_from_pandas") as mock_read_from_pandas:
            mock_read_from_pandas.return_value = DatalakeColumnWrapper(dataframes=[])

            gcs_reader._read_dsv_dispatch(
                mock_config_source, key="test.csv.gz", bucket_name="test-bucket"
            )

            call_kwargs = mock_read_from_pandas.call_args[1]
            self.assertEqual(call_kwargs["compression"], "gzip")

    @patch("metadata.readers.dataframe.base.get_reader")
    @patch("pandas.read_csv")
    def test_s3_dispatch(self, mock_read_csv, mock_get_reader):
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        mock_client = MagicMock()
        mock_body = io.BytesIO(b"col1,col2\n1,2\n3,4")
        mock_client.get_object.return_value = {"Body": mock_body}

        mock_config_source = S3Config()
        s3_reader = DSVDataFrameReader(
            config_source=mock_config_source, client=mock_client
        )

        mock_df = pd.DataFrame({"col1": [1, 3], "col2": [2, 4]})
        mock_context_manager = MagicMock()
        mock_context_manager.__enter__.return_value = [mock_df]
        mock_context_manager.__exit__ = Mock(return_value=False)
        mock_read_csv.return_value = mock_context_manager

        result = s3_reader._read_dsv_dispatch(
            mock_config_source, key="test.csv", bucket_name="test-bucket"
        )

        mock_client.get_object.assert_called_once_with(
            Bucket="test-bucket", Key="test.csv"
        )
        self.assertIsInstance(result, DatalakeColumnWrapper)

    @patch("metadata.readers.dataframe.base.get_reader")
    @patch("metadata.readers.dataframe.dsv.return_azure_storage_options")
    def test_azure_dispatch(self, mock_storage_options, mock_get_reader):
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        mock_storage_options.return_value = {"account_key": "test_key"}

        mock_config_source = AzureConfig()
        mock_config_source.securityConfig = MagicMock()
        mock_config_source.securityConfig.accountName = "testaccount"

        azure_reader = DSVDataFrameReader(config_source=mock_config_source, client=None)

        with patch.object(azure_reader, "read_from_pandas") as mock_read_from_pandas:
            mock_read_from_pandas.return_value = DatalakeColumnWrapper(dataframes=[])

            azure_reader._read_dsv_dispatch(
                mock_config_source, key="test.csv", bucket_name="test-container"
            )

            mock_read_from_pandas.assert_called_once()
            call_kwargs = mock_read_from_pandas.call_args[1]
            self.assertIn("testaccount", call_kwargs["path"])
            self.assertIn("test-container", call_kwargs["path"])
            self.assertEqual(
                call_kwargs["storage_options"], {"account_key": "test_key"}
            )

    @patch("metadata.readers.dataframe.base.get_reader")
    def test_local_dispatch(self, mock_get_reader):
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        mock_config_source = LocalConfig()
        local_reader = DSVDataFrameReader(config_source=mock_config_source, client=None)

        with patch.object(local_reader, "read_from_pandas") as mock_read_from_pandas:
            mock_read_from_pandas.return_value = DatalakeColumnWrapper(dataframes=[])

            local_reader._read_dsv_dispatch(
                mock_config_source, key="/local/path/test.csv", bucket_name="unused"
            )

            mock_read_from_pandas.assert_called_once()
            call_kwargs = mock_read_from_pandas.call_args[1]
            self.assertEqual(call_kwargs["path"], "/local/path/test.csv")


class TestCSVDataFrameReader(TestCase):
    """
    Test CSVDataFrameReader factory function
    """

    @patch("metadata.readers.dataframe.base.get_reader")
    def test_csv_reader_has_csv_separator(self, mock_get_reader):
        mock_config_source = MagicMock()
        mock_client = MagicMock()
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        csv_reader = CSVDataFrameReader(
            config_source=mock_config_source, client=mock_client
        )

        self.assertEqual(csv_reader.separator, CSV_SEPARATOR)
        self.assertEqual(csv_reader.separator, ",")


class TestTSVDataFrameReader(TestCase):
    """
    Test TSVDataFrameReader factory function
    """

    @patch("metadata.readers.dataframe.base.get_reader")
    def test_tsv_reader_has_tsv_separator(self, mock_get_reader):
        mock_config_source = MagicMock()
        mock_client = MagicMock()
        mock_reader = MagicMock()
        mock_get_reader.return_value = mock_reader

        tsv_reader = TSVDataFrameReader(
            config_source=mock_config_source, client=mock_client
        )

        self.assertEqual(tsv_reader.separator, TSV_SEPARATOR)
        self.assertEqual(tsv_reader.separator, "\t")
