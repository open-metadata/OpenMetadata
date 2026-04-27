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
Tests for N+1 HEAD request elimination.

Problem: list_objects_v2 returns file Size, but readers made separate
head_object / s3_fs.info() calls per file to determine the size.

Fix: Thread file_size through DatalakeTableSchemaWrapper so readers
skip the extra API call when size is already known.
"""

from collections import namedtuple
from unittest.mock import MagicMock, Mock, patch

from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.readers.dataframe.json import JSONDataFrameReader
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.readers.dataframe.parquet import ParquetDataFrameReader


def _s3_config():
    return S3Config(
        securityConfig=AWSCredentials(awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1")
    )


def _mock_session():
    mock_session = Mock()
    FrozenCreds = namedtuple("FrozenCreds", ["access_key", "secret_key", "token"])
    mock_session.get_credentials.return_value.get_frozen_credentials.return_value = FrozenCreds(
        access_key="test", secret_key="test", token=None
    )
    return mock_session


class TestNPlusOneHeadRequests:
    """Prove that readers still fall back to HEAD/info when file_size is NOT provided."""

    def test_json_reader_calls_head_object_when_no_size(self):
        """Without file_size, JSON reader falls back to head_object."""
        mock_client = Mock()
        mock_client.head_object.return_value = {"ContentLength": 1024}

        json_content = b'[{"id": 1}]'

        def make_body():
            body = Mock()
            body.readline.return_value = json_content
            body.read.return_value = json_content
            body.__enter__ = Mock(return_value=body)
            body.__exit__ = Mock(return_value=False)
            return body

        mock_client.get_object.side_effect = lambda **kw: {"Body": make_body()}

        reader = JSONDataFrameReader(_s3_config(), mock_client)

        try:
            reader._read(key="data/test.json", bucket_name="bucket")
        except Exception:
            pass

        assert mock_client.head_object.call_count == 1

    @patch("s3fs.S3FileSystem")
    def test_parquet_reader_calls_info_when_no_size(self, mock_s3fs_cls):
        """Without file_size, parquet reader falls back to s3_fs.info()."""
        mock_client = Mock()
        mock_session = _mock_session()

        mock_fs = MagicMock()
        mock_s3fs_cls.return_value = mock_fs
        mock_fs.info.return_value = {"size": 1024}

        reader = ParquetDataFrameReader(_s3_config(), mock_client, session=mock_session)

        reader._read(key="data/test.parquet", bucket_name="bucket")

        assert mock_fs.info.call_count == 1


class TestFileSizePassthrough:
    """Verify readers skip HEAD/info when file_size is provided."""

    @patch("s3fs.S3FileSystem")
    def test_parquet_reader_skips_info_when_size_provided(self, mock_s3fs_cls):
        """When file_size is passed, parquet reader should NOT call s3_fs.info()."""
        mock_client = Mock()
        mock_session = _mock_session()

        mock_fs = MagicMock()
        mock_s3fs_cls.return_value = mock_fs

        mock_pf = Mock()  # noqa: F841
        mock_table = Mock()
        mock_table.to_pandas.return_value = Mock()

        reader = ParquetDataFrameReader(_s3_config(), mock_client, session=mock_session)

        reader._read(key="data/test.parquet", bucket_name="bucket", file_size=1024)

        mock_fs.info.assert_not_called()

    def test_json_reader_skips_head_when_size_provided(self):
        """When file_size is passed, JSON reader should NOT call head_object."""
        mock_client = Mock()
        mock_client.head_object.return_value = {"ContentLength": 1024}

        json_content = b'[{"id": 1}]'

        def make_body():
            body = Mock()
            body.readline.return_value = json_content
            body.read.return_value = json_content
            body.__enter__ = Mock(return_value=body)
            body.__exit__ = Mock(return_value=False)
            return body

        mock_client.get_object.side_effect = lambda **kw: {"Body": make_body()}

        reader = JSONDataFrameReader(_s3_config(), mock_client)

        try:
            reader._read(key="data/test.json", bucket_name="bucket", file_size=1024)
        except Exception:
            pass

        mock_client.head_object.assert_not_called()

    def test_table_schema_wrapper_accepts_file_size(self):
        """DatalakeTableSchemaWrapper should accept an optional file_size field."""
        wrapper = DatalakeTableSchemaWrapper(
            key="data/test.parquet",
            bucket_name="bucket",
            file_size=12345,
        )
        assert wrapper.file_size == 12345

    def test_table_schema_wrapper_file_size_defaults_none(self):
        """file_size should default to None when not provided."""
        wrapper = DatalakeTableSchemaWrapper(
            key="data/test.parquet",
            bucket_name="bucket",
        )
        assert wrapper.file_size is None

    @patch("s3fs.S3FileSystem")
    def test_parquet_reader_works_without_session(self, mock_s3fs_cls):
        """Parquet reader should not crash when session is None (profiler/storage path).
        Falls back to credentials from config."""
        mock_client = Mock()

        mock_fs = MagicMock()
        mock_s3fs_cls.return_value = mock_fs
        mock_fs.info.return_value = {"size": 1024}

        reader = ParquetDataFrameReader(_s3_config(), mock_client, session=None)

        reader._read(key="data/test.parquet", bucket_name="bucket")

        # Without session, s3fs falls back to config credentials
        mock_s3fs_cls.assert_called_once()
        call_kwargs = mock_s3fs_cls.call_args.kwargs
        assert call_kwargs["key"] == "test"

    def test_get_table_names_yields_key_and_size(self):
        """S3 client get_table_names should yield (key, size) tuples."""
        from metadata.ingestion.source.database.datalake.clients.s3 import (
            DatalakeS3Client,
        )

        mock_boto_client = Mock()
        mock_paginator = Mock()
        mock_boto_client.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Contents": [
                    {"Key": "data/a.parquet", "Size": 100},
                    {"Key": "data/b.csv", "Size": 200},
                ]
            }
        ]

        client = DatalakeS3Client(client=mock_boto_client)
        results = list(client.get_table_names("bucket", prefix=None))

        assert results == [("data/a.parquet", 100), ("data/b.csv", 200)]

    def test_gcs_get_file_size_uses_client(self):
        """GCS _get_file_size_mb should use self.client, not bare GCSFileSystem."""
        from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
            GCSConfig,
        )
        from metadata.readers.dataframe.json import JSONDataFrameReader

        mock_client = Mock()
        mock_blob = Mock()
        mock_blob.size = 5 * 1024 * 1024  # 5MB
        mock_bucket = Mock()
        mock_bucket.get_blob.return_value = mock_blob
        mock_client.get_bucket.return_value = mock_bucket

        config = GCSConfig()
        reader = JSONDataFrameReader(config, mock_client)

        result = reader._get_file_size_mb("data/test.json", "test-bucket")

        assert result == 5.0
        mock_client.get_bucket.assert_called_once_with("test-bucket")
        mock_bucket.get_blob.assert_called_once_with("data/test.json")

    def test_gcs_get_file_size_handles_missing_blob(self):
        """GCS _get_file_size_mb should return 0 if blob doesn't exist."""
        from metadata.generated.schema.entity.services.connections.database.datalake.gcsConfig import (
            GCSConfig,
        )
        from metadata.readers.dataframe.json import JSONDataFrameReader

        mock_client = Mock()
        mock_bucket = Mock()
        mock_bucket.get_blob.return_value = None
        mock_client.get_bucket.return_value = mock_bucket

        config = GCSConfig()
        reader = JSONDataFrameReader(config, mock_client)

        result = reader._get_file_size_mb("data/missing.json", "test-bucket")

        assert result == 0

    def test_azure_get_file_size_uses_client(self):
        """Azure _get_file_size_mb should use self.client, not new AzureBlobFileSystem."""
        from metadata.generated.schema.entity.services.connections.database.datalake.azureConfig import (
            AzureConfig,
        )
        from metadata.generated.schema.security.credentials.azureCredentials import (
            AzureCredentials,
        )
        from metadata.readers.dataframe.json import JSONDataFrameReader

        mock_client = Mock()
        mock_blob_client = Mock()
        mock_props = Mock()
        mock_props.size = 10 * 1024 * 1024  # 10MB
        mock_blob_client.get_blob_properties.return_value = mock_props
        mock_client.get_blob_client.return_value = mock_blob_client

        config = AzureConfig(securityConfig=AzureCredentials(accountName="test", clientId="test", tenantId="test"))
        reader = JSONDataFrameReader(config, mock_client)

        result = reader._get_file_size_mb("data/test.json", "test-container")

        assert result == 10.0
        mock_client.get_blob_client.assert_called_once_with(container="test-container", blob="data/test.json")
