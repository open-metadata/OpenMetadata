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
        """Test basic CSV reading with standard format."""
        csv_content = "id,name,age\n1,Alice,25\n2,Bob,30\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(csv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (2, 3))
            self.assertListEqual(list(chunks[0].columns), ["id", "name", "age"])
        finally:
            import os

            os.unlink(tmp_path)

    def test_tsv_reader_local(self):
        """Test basic TSV reading with tab separator."""
        tsv_content = "id\tname\tage\n1\tAlice\t25\n2\tBob\t30\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".tsv", delete=False) as tmp:
            tmp.write(tsv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = TSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (2, 3))
        finally:
            import os

            os.unlink(tmp_path)

    def test_csv_with_gzip_compression(self):
        """Test CSV reading with gzip compression."""
        csv_content = "id,name\n1,Test\n"

        with tempfile.NamedTemporaryFile(suffix=".csv.gz", delete=False) as tmp:
            with gzip.open(tmp.name, "wt") as gz:
                gz.write(csv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
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

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertTrue(len(chunks) > 0)
            self.assertListEqual(list(chunks[0].columns), ["col1", "col2", "col3"])
        finally:
            import os

            os.unlink(tmp_path)

    def test_custom_separator(self):
        """Test CSV reading with custom separator."""
        custom_csv = "id;name;age\n1;Alice;25\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(custom_csv)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = DSVDataFrameReader(config, None, separator=";")

            result = reader._read(key=tmp_path, bucket_name="")

            self.assertIsNotNone(result.dataframes)
            dataframes = result.dataframes()
            self.assertIsNotNone(dataframes)
            chunks = list(dataframes)
            self.assertEqual(len(chunks), 1)
            self.assertListEqual(list(chunks[0].columns), ["id", "name", "age"])
        finally:
            import os

            os.unlink(tmp_path)

    @patch("pandas.read_csv")
    def test_gcs_csv_reading(self, mock_read_csv):
        """Test GCS CSV reading with mocked pandas."""
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

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)
        self.assertEqual(len(chunks), 1)
        pd.testing.assert_frame_equal(chunks[0], mock_df)

    @patch("pandas.read_csv")
    @patch("metadata.readers.dataframe.dsv.return_s3_storage_options")
    def test_s3_csv_reading(self, mock_storage_opts, mock_read_csv):
        """Test S3 CSV reading with mocked pandas."""
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

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)
        self.assertEqual(len(chunks), 1)

    @patch("pandas.read_csv")
    @patch("metadata.readers.dataframe.dsv.return_azure_storage_options")
    def test_azure_csv_reading(self, mock_storage_opts, mock_read_csv):
        """Test Azure CSV reading with mocked pandas."""
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

        self.assertIsNotNone(result.dataframes)
        dataframes = result.dataframes()
        self.assertIsNotNone(dataframes)
        chunks = list(dataframes)
        self.assertEqual(len(chunks), 1)

    def test_csv_standard_with_special_characters(self):
        """Test standard CSV with commas in quoted fields, empty values, and special characters."""
        csv_content = 'id,name,address,notes\n1,"John Doe","123 Main St, City, State","Active customer"\n2,"Jane Smith",,"VIP status, priority"\n3,,,""\n'

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(csv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            chunks = list(result.dataframes())
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (3, 4))

            # Row 1: standard values with commas in quoted field
            self.assertEqual(chunks[0].iloc[0]["id"], 1)
            self.assertEqual(chunks[0].iloc[0]["name"], "John Doe")
            self.assertEqual(chunks[0].iloc[0]["address"], "123 Main St, City, State")
            self.assertEqual(chunks[0].iloc[0]["notes"], "Active customer")

            # Row 2: empty address, comma in notes
            self.assertEqual(chunks[0].iloc[1]["id"], 2)
            self.assertEqual(chunks[0].iloc[1]["name"], "Jane Smith")
            self.assertTrue(pd.isna(chunks[0].iloc[1]["address"]))
            self.assertEqual(chunks[0].iloc[1]["notes"], "VIP status, priority")

            # Row 3: mostly empty
            self.assertEqual(chunks[0].iloc[2]["id"], 3)
            self.assertTrue(pd.isna(chunks[0].iloc[2]["name"]))
            self.assertTrue(pd.isna(chunks[0].iloc[2]["address"]))
            self.assertTrue(pd.isna(chunks[0].iloc[2]["notes"]))
        finally:
            import os

            os.unlink(tmp_path)

    def test_csv_complex_escaping_backslash_and_double_quote(self):
        """Test complex CSV with both backslash escaping (\") and double-quote escaping ("") in same file."""
        csv_content = (
            "product,quantity,description,metadata\n"
            '"Part A",5,"Interlocked Flexible Metal Conduit, Galvanized, 50mm dia. (2\\"), Normal","Stock: ""In warehouse"""\n'
            '"Component B",10,"Value with \\"quote\\" and, comma","Status: ""Active"" and \\"Ready\\""\n'
            '"Item C",3,"Windows path: C:\\\\Users\\\\data.txt","Mix of ""both"" styles"\n'
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as tmp:
            tmp.write(csv_content)
            tmp_path = tmp.name

        try:
            config = LocalConfig()
            reader = CSVDataFrameReader(config, None)

            result = reader._read(key=tmp_path, bucket_name="")

            chunks = list(result.dataframes())
            self.assertEqual(len(chunks), 1)
            self.assertEqual(chunks[0].shape, (3, 4))

            # Row 1: backslash-escaped quote in description, double-quote in metadata
            self.assertEqual(chunks[0].iloc[0]["product"], "Part A")
            self.assertEqual(chunks[0].iloc[0]["quantity"], 5)
            self.assertEqual(
                chunks[0].iloc[0]["description"],
                'Interlocked Flexible Metal Conduit, Galvanized, 50mm dia. (2"), Normal',
            )
            self.assertEqual(chunks[0].iloc[0]["metadata"], 'Stock: "In warehouse"')

            # Row 2: both backslash and double-quote escaping in same fields
            self.assertEqual(chunks[0].iloc[1]["product"], "Component B")
            self.assertEqual(chunks[0].iloc[1]["quantity"], 10)
            self.assertEqual(
                chunks[0].iloc[1]["description"], 'Value with "quote" and, comma'
            )
            self.assertEqual(
                chunks[0].iloc[1]["metadata"], 'Status: "Active" and "Ready"'
            )

            # Row 3: Windows path with backslashes, double-quote in metadata
            self.assertEqual(chunks[0].iloc[2]["product"], "Item C")
            self.assertEqual(chunks[0].iloc[2]["quantity"], 3)
            self.assertEqual(
                chunks[0].iloc[2]["description"], "Windows path: C:\\Users\\data.txt"
            )
            self.assertEqual(chunks[0].iloc[2]["metadata"], 'Mix of "both" styles')
        finally:
            import os

            os.unlink(tmp_path)

    def test_csv_edge_cases_with_newlines_and_mixed_quotes(self):
        """Test edge cases with newlines in quoted fields and complex mixed escaping."""
        csv_content = (
            "id,text,value\n"
            '1,"Multi-line text:\nLine 1\nLine 2 with \\"quote\\"","Simple"\n'
            '2,"Text with ""double"" and \\"backslash\\" quotes","Complex, with comma"\n'
        )

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

            # Row 1: multi-line text with backslash-escaped quotes
            self.assertEqual(chunks[0].iloc[0]["id"], 1)
            self.assertEqual(
                chunks[0].iloc[0]["text"],
                'Multi-line text:\nLine 1\nLine 2 with "quote"',
            )
            self.assertEqual(chunks[0].iloc[0]["value"], "Simple")

            # Row 2: both types of escaping in same field
            self.assertEqual(chunks[0].iloc[1]["id"], 2)
            self.assertEqual(
                chunks[0].iloc[1]["text"], 'Text with "double" and "backslash" quotes'
            )
            self.assertEqual(chunks[0].iloc[1]["value"], "Complex, with comma")
        finally:
            import os

            os.unlink(tmp_path)


if __name__ == "__main__":
    unittest.main()
