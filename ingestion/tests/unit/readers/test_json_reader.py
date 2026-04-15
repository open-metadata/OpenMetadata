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
Tests for JSONDataFrameReader
"""
import gzip
import json
import tempfile
import unittest
import zipfile
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
from metadata.readers.dataframe.json import JSONDataFrameReader


class TestJSONReader(unittest.TestCase):
    def test_json_lines_local(self):
        json_lines = '{"id": 1, "name": "Alice"}\n{"id": 2, "name": "Bob"}\n'

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False
        ) as tmp:
            tmp.write(json_lines)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertTrue(len(chunks) > 0)
            total_rows = sum(len(chunk) for chunk in chunks)
            self.assertEqual(total_rows, 2)
        finally:
            import os

            os.unlink(tmp_path)

    def test_json_array_local(self):
        json_array = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
            json.dump(json_array, tmp)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            total_rows = sum(len(chunk) for chunk in chunks)
            self.assertEqual(total_rows, 2)
        finally:
            import os

            os.unlink(tmp_path)

    def test_json_object_local(self):
        json_obj = {"id": 1, "name": "Alice"}

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
            json.dump(json_obj, tmp)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape[0], 1)
        finally:
            import os

            os.unlink(tmp_path)

    def test_json_gzip_compression(self):
        json_data = [{"id": 1, "name": "Test"}]

        with tempfile.NamedTemporaryFile(suffix=".json.gz", delete=False) as tmp:
            with gzip.open(tmp.name, "wt") as gz:
                json.dump(json_data, gz)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertTrue(len(chunks) > 0)
        finally:
            import os

            os.unlink(tmp_path)

    def test_json_zip_compression(self):
        json_data = [{"id": 1, "name": "Test"}]

        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            with zipfile.ZipFile(tmp_path, "w") as zf:
                zf.writestr("data.json", json.dumps(json_data))

            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertTrue(len(chunks) > 0)
        finally:
            import os

            os.unlink(tmp_path)

    def test_is_json_lines_detection(self):
        import io

        jsonl_content = '{"id": 1}\n{"id": 2}\n'
        jsonl_file = io.BytesIO(jsonl_content.encode())

        is_jsonl = JSONDataFrameReader._is_json_lines(jsonl_file)
        self.assertTrue(is_jsonl)

    def test_stream_json_lines(self):
        import io

        jsonl_content = '{"id": 1}\n{"id": 2}\n{"id": 3}\n'
        jsonl_file = io.BytesIO(jsonl_content.encode())

        chunks = list(JSONDataFrameReader._stream_json_lines(jsonl_file, batch_size=2))

        self.assertEqual(len(chunks), 2)
        self.assertEqual(len(chunks[0]), 2)
        self.assertEqual(len(chunks[1]), 1)

    @patch("gcsfs.GCSFileSystem")
    def test_gcs_json_reading(self, mock_gcsfs):
        import io

        mock_gcs = Mock()
        mock_gcsfs.return_value = mock_gcs

        json_data = b'{"id": 1, "name": "Test"}'
        mock_file = io.BytesIO(json_data)
        mock_gcs.open.return_value.__enter__ = Mock(return_value=mock_file)
        mock_gcs.open.return_value.__exit__ = Mock(return_value=False)
        mock_gcs.info.return_value = {"size": len(json_data)}

        config = GCSConfig()
        reader = JSONDataFrameReader(config, None)

        result = reader._read(key="test.json", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)

    @patch("adlfs.AzureBlobFileSystem")
    @patch("metadata.readers.dataframe.json.return_azure_storage_options")
    def test_azure_json_reading(self, mock_storage_opts, mock_adlfs):
        import io

        mock_storage_opts.return_value = {"connection_string": "test"}
        mock_fs = Mock()
        mock_adlfs.return_value = mock_fs

        json_data = b'{"id": 1, "name": "Test"}'
        mock_file = io.BytesIO(json_data)
        mock_fs.open.return_value.__enter__ = Mock(return_value=mock_file)
        mock_fs.open.return_value.__exit__ = Mock(return_value=False)
        mock_fs.info.return_value = {"size": len(json_data)}

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="test", clientId="test", tenantId="test"
            )
        )
        reader = JSONDataFrameReader(config, None)

        result = reader._read(key="test.json", bucket_name="test-container")

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)

    def test_s3_json_reading(self):
        import io

        json_data = b'{"id": 1, "name": "Test"}'

        mock_client = Mock()
        mock_body = io.BytesIO(json_data)
        mock_client.get_object.return_value = {"Body": mock_body}
        mock_client.head_object.return_value = {"ContentLength": len(json_data)}

        config = S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
        )
        reader = JSONDataFrameReader(config, mock_client)

        result = reader._read(key="test.json", bucket_name="test-bucket")

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)

    def test_empty_json_lines(self):
        import io

        jsonl_content = '{"id": 1}\n\n{"id": 2}\n'
        jsonl_file = io.BytesIO(jsonl_content.encode())

        chunks = list(JSONDataFrameReader._stream_json_lines(jsonl_file))

        total_rows = sum(len(chunk) for chunk in chunks)
        self.assertEqual(total_rows, 2)


class TestSchemaInferenceEfficiency(unittest.TestCase):
    """read_first_chunk should not read the entire file for schema inference."""

    def test_read_first_chunk_reads_minimal_records(self):
        """For schema inference, read_first_chunk should read far fewer
        than CHUNKSIZE (100K) records — only enough to determine the schema."""
        # Create a JSON Lines file with 1000 records
        records = [
            json.dumps({"id": i, "name": f"user_{i}", "score": i * 1.1})
            for i in range(1000)
        ]
        content = "\n".join(records)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader.read_first_chunk(key=tmp_path, bucket_name="")

            assert result.dataframes is not None
            chunk = next(result.dataframes())

            # Schema inference only needs a small sample, not all 1000 records.
            # Currently reads min(CHUNKSIZE, total_records) = 1000.
            # After fix, should read a small sample (e.g., 100).
            assert len(chunk) <= 200, (
                f"read_first_chunk read {len(chunk)} records for schema inference. "
                f"Expected <= 200 — only need a few records for column names/types."
            )
        finally:
            import os

            os.unlink(tmp_path)

    def test_full_read_still_uses_large_chunksize(self):
        """Full read() (not schema inference) should still use CHUNKSIZE
        to avoid yielding too many small DataFrames."""
        records = [json.dumps({"id": i, "name": f"user_{i}"}) for i in range(500)]
        content = "\n".join(records)

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".jsonl", delete=False
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = JSONDataFrameReader(config, None)

            result = reader.read(key=tmp_path, bucket_name="")

            dataframes = result.dataframes
            if callable(dataframes):
                dataframes = dataframes()
            chunks = list(dataframes)

            # Full read should batch all 500 records into one chunk
            # (since 500 < CHUNKSIZE=100K), not 5 chunks of 100
            assert len(chunks) == 1
            assert len(chunks[0]) == 500
        finally:
            import os

            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
