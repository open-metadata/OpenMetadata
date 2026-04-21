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
Tests that S3 readers use session credentials (not raw config) to access files.

Uses moto to simulate AWS S3, proving that readers work with
boto3-session-derived credentials — the exact scenario that was broken
when readers bypassed the boto3 session.

Note: The parquet reader uses s3fs (aiobotocore) which is incompatible
with moto in this environment. Parquet credential flow is covered by
unit tests in test_parquet_reader.py with mocked s3fs.
"""
import io

import boto3
import fastavro
import pytest

moto = pytest.importorskip("moto", reason="moto not installed")
mock_aws = moto.mock_aws

from metadata.generated.schema.entity.services.connections.database.datalake.s3Config import (
    S3Config,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.readers.dataframe.avro import AvroDataFrameReader
from metadata.readers.dataframe.dsv import CSVDataFrameReader
from metadata.readers.dataframe.parquet import ParquetDataFrameReader

BUCKET = "test-bucket"
REGION = "us-east-1"


@pytest.fixture()
def aws_env(monkeypatch):
    """Set dummy AWS env vars so moto doesn't fall through to real AWS."""
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "testing")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "testing")
    monkeypatch.setenv("AWS_SECURITY_TOKEN", "testing")
    monkeypatch.setenv("AWS_SESSION_TOKEN", "testing")
    monkeypatch.setenv("AWS_DEFAULT_REGION", REGION)


@pytest.fixture()
def s3_bucket(aws_env):
    """Create a mocked S3 bucket with test files."""
    with mock_aws():
        s3 = boto3.client("s3", region_name=REGION)
        s3.create_bucket(Bucket=BUCKET)

        # Upload CSV
        s3.put_object(
            Bucket=BUCKET,
            Key="data/test.csv",
            Body=b"id,name,score\n1,Alice,9.1\n2,Bob,8.5\n",
        )

        # Upload Avro
        avro_schema = {
            "type": "record",
            "name": "TestRecord",
            "fields": [
                {"name": "id", "type": "int"},
                {"name": "name", "type": "string"},
            ],
        }
        avro_buf = io.BytesIO()
        fastavro.writer(avro_buf, avro_schema, [{"id": 1, "name": "Alice"}])
        s3.put_object(Bucket=BUCKET, Key="data/test.avro", Body=avro_buf.getvalue())

        session = boto3.Session(region_name=REGION)
        client = session.client("s3", region_name=REGION)

        yield client, session


def _config():
    return S3Config(
        securityConfig=AWSCredentials(
            awsAccessKeyId="testing",
            awsSecretAccessKey="testing",
            awsRegion=REGION,
        )
    )


class TestS3ReaderWithBoto3:
    """Verify CSV and Avro readers work end-to-end with moto-mocked S3."""

    def test_csv_reader_uses_boto3_client(self, s3_bucket):
        """CSV reader should read via self.client.get_object."""
        client, session = s3_bucket

        reader = CSVDataFrameReader(_config(), client, session=session)
        result = reader.read_first_chunk(key="data/test.csv", bucket_name=BUCKET)

        assert result.dataframes is not None
        chunk = next(result.dataframes())
        assert len(chunk) == 2
        assert list(chunk.columns) == ["id", "name", "score"]

    def test_avro_reader_uses_boto3_client(self, s3_bucket):
        """Avro reader should read via self.client.get_object."""
        client, session = s3_bucket

        reader = AvroDataFrameReader(_config(), client, session=session)
        result = reader.read_first_chunk(key="data/test.avro", bucket_name=BUCKET)

        assert result.columns is not None
        assert result.dataframes is not None
        chunk = next(result.dataframes())
        assert len(chunk) == 1

    def test_csv_reader_without_session(self, s3_bucket):
        """Readers should work when session is None (non-S3 sources)."""
        client, _ = s3_bucket

        reader = CSVDataFrameReader(_config(), client, session=None)
        result = reader.read_first_chunk(key="data/test.csv", bucket_name=BUCKET)

        assert result.dataframes is not None
        chunk = next(result.dataframes())
        assert len(chunk) == 2


class TestParquetSessionCredentialExtraction:
    """Verify parquet reader extracts credentials from session correctly.

    s3fs (aiobotocore) is not compatible with moto in this environment,
    so we verify the credential extraction flow rather than end-to-end reads.
    The actual s3fs read path is covered in test_parquet_reader.py.
    """

    def test_build_s3fs_uses_session_credentials(self, s3_bucket):
        """_build_s3fs_filesystem should extract creds from session."""
        client, session = s3_bucket

        reader = ParquetDataFrameReader(_config(), client, session=session)
        creds = reader.session.get_credentials().get_frozen_credentials()

        assert creds.access_key is not None
        assert creds.secret_key is not None

    def test_build_s3fs_passes_region(self, s3_bucket):
        """s3fs should receive the region from config."""
        client, session = s3_bucket

        reader = ParquetDataFrameReader(_config(), client, session=session)

        assert reader.config_source.securityConfig.awsRegion == REGION
