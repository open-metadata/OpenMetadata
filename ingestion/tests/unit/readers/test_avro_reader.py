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
Tests for AvroDataFrameReader
"""
import io
import unittest
from unittest.mock import Mock, patch

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
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.readers.dataframe.avro import AvroDataFrameReader


class TestAvroReader(unittest.TestCase):
    def setUp(self):
        self.test_records = [
            {"id": 1, "name": "Alice", "age": 25},
            {"id": 2, "name": "Bob", "age": 30},
            {"id": 3, "name": "Charlie", "age": 35},
        ]

    def _create_mock_avro_file(self):
        import fastavro

        schema = {
            "type": "record",
            "name": "User",
            "fields": [
                {"name": "id", "type": "int"},
                {"name": "name", "type": "string"},
                {"name": "age", "type": "int"},
            ],
        }

        avro_bytes = io.BytesIO()
        fastavro.writer(avro_bytes, schema, self.test_records)
        avro_bytes.seek(0)
        return avro_bytes

    def test_stream_avro_records(self):
        avro_file = self._create_mock_avro_file()
        chunks = list(AvroDataFrameReader._stream_avro_records(avro_file, batch_size=2))

        self.assertEqual(len(chunks), 2)
        self.assertEqual(len(chunks[0]), 2)
        self.assertEqual(len(chunks[1]), 1)

    def test_get_avro_columns(self):
        avro_file = self._create_mock_avro_file()
        columns = AvroDataFrameReader._get_avro_columns(avro_file)

        self.assertIsNotNone(columns)
        self.assertEqual(len(columns), 1)
        self.assertEqual(len(columns[0].children), 3)

    @patch("s3fs.S3FileSystem")
    @patch("metadata.readers.dataframe.avro.return_s3_storage_options")
    def test_s3_avro_reading(self, mock_storage_opts, mock_s3fs):
        mock_storage_opts.return_value = {}
        mock_s3 = Mock()
        mock_s3fs.return_value = mock_s3

        def create_fresh_file():
            return self._create_mock_avro_file()

        mock_s3.open.return_value.__enter__ = Mock(
            side_effect=lambda: create_fresh_file()
        )
        mock_s3.open.return_value.__exit__ = Mock(return_value=False)

        mock_client = Mock()
        mock_response = {"Body": create_fresh_file()}
        mock_client.get_object.return_value = mock_response

        config = S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
        )
        reader = AvroDataFrameReader(config, mock_client)

        result = reader._read(key="test.avro", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        chunks = list(result.dataframes)
        self.assertTrue(len(chunks) > 0)

    @patch("gcsfs.GCSFileSystem")
    def test_gcs_avro_reading(self, mock_gcsfs):
        mock_gcs = Mock()
        mock_gcsfs.return_value = mock_gcs

        def create_fresh_file():
            return self._create_mock_avro_file()

        mock_gcs.open.return_value.__enter__ = Mock(
            side_effect=lambda: create_fresh_file()
        )
        mock_gcs.open.return_value.__exit__ = Mock(return_value=False)

        config = GCSConfig()
        reader = AvroDataFrameReader(config, None)

        result = reader._read(key="test.avro", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        chunks = list(result.dataframes)
        self.assertTrue(len(chunks) > 0)

    @patch("adlfs.AzureBlobFileSystem")
    @patch("metadata.readers.dataframe.avro.return_azure_storage_options")
    def test_azure_avro_reading(self, mock_storage_opts, mock_adlfs):
        mock_storage_opts.return_value = {"connection_string": "test"}
        mock_fs = Mock()
        mock_adlfs.return_value = mock_fs

        def create_fresh_file():
            return self._create_mock_avro_file()

        mock_fs.open.return_value.__enter__ = Mock(
            side_effect=lambda: create_fresh_file()
        )
        mock_fs.open.return_value.__exit__ = Mock(return_value=False)

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="test", clientId="test", tenantId="test"
            )
        )
        reader = AvroDataFrameReader(config, None)

        result = reader._read(key="test.avro", bucket_name="test-container")

        self.assertIsNotNone(result.dataframes)
        chunks = list(result.dataframes)
        self.assertTrue(len(chunks) > 0)

    def test_local_avro_reading(self):
        import tempfile

        import fastavro

        schema = {
            "type": "record",
            "name": "User",
            "fields": [
                {"name": "id", "type": "int"},
                {"name": "name", "type": "string"},
            ],
        }

        with tempfile.NamedTemporaryFile(suffix=".avro", delete=False) as tmp:
            fastavro.writer(tmp, schema, [{"id": 1, "name": "Test"}])
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = AvroDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            self.assertIsNotNone(result.columns)

            chunks = list(result.dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape[0], 1)
        finally:
            import os

            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
