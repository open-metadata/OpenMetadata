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
Tests for DSVDataFrameReader (CSV/TSV)
"""
import gzip
import tempfile
import unittest
from unittest.mock import patch

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
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.security.credentials.azureCredentials import (
    AzureCredentials,
)
from metadata.readers.dataframe.dsv import (
    CSVDataFrameReader,
    DSVDataFrameReader,
    TSVDataFrameReader,
)


class TestDSVReader(unittest.TestCase):
    def test_csv_reader_local(self):
        csv_content = "id,name,age\n1,Alice,25\n2,Bob,30\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(csv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            chunks = list(result.dataframes())
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (2, 3))
            self.assertListEqual(list(chunks[0].columns), ["id", "name", "age"])
        finally:
            import os

            os.unlink(tmp_path)

    def test_tsv_reader_local(self):
        tsv_content = "id\tname\tage\n1\tAlice\t25\n2\tBob\t30\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False) as tmp:
            tmp.write(tsv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = TSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            dataframes = (
                result.dataframes()
                if callable(result.dataframes)
                else result.dataframes
            )
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (2, 3))
        finally:
            import os

            os.unlink(tmp_path)

    def test_csv_with_gzip_compression(self):
        csv_content = "id,name\n1,Test\n"

        with tempfile.NamedTemporaryFile(suffix=".csv.gz", delete=False) as tmp:
            with gzip.open(tmp.name, "wt") as gz:
                gz.write(csv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            dataframes = (
                result.dataframes()
                if callable(result.dataframes)
                else result.dataframes
            )
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (1, 2))
        finally:
            import os

            os.unlink(tmp_path)

    def test_malformed_quoted_csv(self):
        malformed_csv = '"col1,col2,col3"\n1,2,3\n4,5,6\n'

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(malformed_csv)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            dataframes = (
                result.dataframes()
                if callable(result.dataframes)
                else result.dataframes
            )
            chunks = list(dataframes)
            self.assertTrue(len(chunks) > 0)
            self.assertListEqual(list(chunks[0].columns), ["col1", "col2", "col3"])
        finally:
            import os

            os.unlink(tmp_path)

    def test_custom_separator(self):
        custom_csv = "id;name;age\n1;Alice;25\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(custom_csv)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = DSVDataFrameReader(config, None, separator=";")

            result = reader._read(key=tmp_path, bucket_name="")

            dataframes = (
                result.dataframes()
                if callable(result.dataframes)
                else result.dataframes
            )
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertListEqual(list(chunks[0].columns), ["id", "name", "age"])
        finally:
            import os

            os.unlink(tmp_path)

    @patch("pandas.read_csv")
    def test_gcs_csv_reading(self, mock_read_csv):
        mock_df = pd.DataFrame({"id": [1], "name": ["Test"]})

        def mock_read_csv_impl(*args, **kwargs):
            class ChunkReader:
                def __enter__(self):
                    return iter([mock_df])

                def __exit__(self, *args):
                    pass

            return ChunkReader()

        mock_read_csv.side_effect = mock_read_csv_impl

        config = GCSConfig()
        reader = CSVDataFrameReader(config, None)

        result = reader._read(key="test.csv", bucket_name="test-bucket")

        dataframes = (
            result.dataframes() if callable(result.dataframes) else result.dataframes
        )
        chunks = list(dataframes)
        self.assertEqual(len(chunks), 1)
        pd.testing.assert_frame_equal(chunks[0], mock_df)

    @patch("pandas.read_csv")
    @patch("metadata.readers.dataframe.dsv.return_s3_storage_options")
    def test_s3_csv_reading(self, mock_storage_opts, mock_read_csv):
        mock_storage_opts.return_value = {}
        mock_df = pd.DataFrame({"id": [1], "name": ["Test"]})

        def mock_read_csv_impl(*args, **kwargs):
            class ChunkReader:
                def __enter__(self):
                    return iter([mock_df])

                def __exit__(self, *args):
                    pass

            return ChunkReader()

        mock_read_csv.side_effect = mock_read_csv_impl

        config = S3Config(
            securityConfig=AWSCredentials(
                awsAccessKeyId="test", awsSecretAccessKey="test", awsRegion="us-east-1"
            )
        )
        reader = CSVDataFrameReader(config, None)

        result = reader._read(key="test.csv", bucket_name="test-bucket")

        dataframes = (
            result.dataframes() if callable(result.dataframes) else result.dataframes
        )
        chunks = list(dataframes)
        self.assertEqual(len(chunks), 1)

    @patch("pandas.read_csv")
    @patch("metadata.readers.dataframe.dsv.return_azure_storage_options")
    def test_azure_csv_reading(self, mock_storage_opts, mock_read_csv):
        mock_storage_opts.return_value = {"connection_string": "test"}
        mock_df = pd.DataFrame({"id": [1], "name": ["Test"]})

        def mock_read_csv_impl(*args, **kwargs):
            class ChunkReader:
                def __enter__(self):
                    return iter([mock_df])

                def __exit__(self, *args):
                    pass

            return ChunkReader()

        mock_read_csv.side_effect = mock_read_csv_impl

        config = AzureConfig(
            securityConfig=AzureCredentials(
                accountName="test", clientId="test", tenantId="test"
            )
        )
        reader = CSVDataFrameReader(config, None)

        result = reader._read(key="test.csv", bucket_name="test-container")

        dataframes = (
            result.dataframes() if callable(result.dataframes) else result.dataframes
        )
        chunks = list(dataframes)
        self.assertEqual(len(chunks), 1)


if __name__ == "__main__":
    unittest.main()
