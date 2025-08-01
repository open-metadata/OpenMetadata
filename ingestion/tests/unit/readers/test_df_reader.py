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
Validate factory and logic to read dataframes from local.
"""
from pathlib import Path
from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    LocalConfig,
)
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.utils.datalake.datalake_utils import fetch_dataframe

ROOT_PATH = Path(__file__).parent.parent / "resources" / "datalake"


class TestDataFrameReader(TestCase):
    """
    Load different files from resources and validate
    that the reader can properly get the df out ot if.
    """

    def test_dsv_no_extension_reader(self):
        key = ROOT_PATH / "transactions_1"

        df_list = fetch_dataframe(
            config_source=LocalConfig(),
            client=None,
            file_fqn=DatalakeTableSchemaWrapper(
                key=str(key), bucket_name="unused", file_extension=SupportedTypes.CSV
            ),
        )

        self.assertIsNotNone(df_list)
        self.assertTrue(len(df_list))

        self.assertEqual(df_list[0].shape, (5, 2))
        self.assertEqual(
            list(df_list[0].columns), ["transaction_id", "transaction_value"]
        )

    def test_dsv_reader(self):
        key = ROOT_PATH / "transactions_1.csv"

        df_list = fetch_dataframe(
            config_source=LocalConfig(),
            client=None,
            file_fqn=DatalakeTableSchemaWrapper(key=str(key), bucket_name="unused"),
        )

        self.assertIsNotNone(df_list)
        self.assertTrue(len(df_list))

        self.assertEqual(df_list[0].shape, (5, 2))
        self.assertEqual(
            list(df_list[0].columns), ["transaction_id", "transaction_value"]
        )

    def test_dsv_reader_with_separator(self):
        key = ROOT_PATH / "transactions_separator.csv"

        df_list = fetch_dataframe(
            config_source=LocalConfig(),
            client=None,
            file_fqn=DatalakeTableSchemaWrapper(
                key=str(key), bucket_name="unused", separator=";"
            ),
        )

        self.assertIsNotNone(df_list)
        self.assertTrue(len(df_list))

        self.assertEqual(df_list[0].shape, (5, 2))
        self.assertEqual(
            list(df_list[0].columns), ["transaction_id", "transaction_value"]
        )

    def test_json_reader(self):
        key = ROOT_PATH / "employees.json"

        df_list = fetch_dataframe(
            config_source=LocalConfig(),
            client=None,
            file_fqn=DatalakeTableSchemaWrapper(key=str(key), bucket_name="unused"),
        )

        self.assertIsNotNone(df_list)
        self.assertTrue(len(df_list))

        self.assertEqual(df_list[0].shape, (4, 4))
        self.assertEqual(
            list(df_list[0].columns),
            ["name", "id", "version", "Company"],
        )

    def test_jsonl_reader(self):
        key = ROOT_PATH / "employees.jsonl"

        df_list = fetch_dataframe(
            config_source=LocalConfig(),
            client=None,
            file_fqn=DatalakeTableSchemaWrapper(key=str(key), bucket_name="unused"),
        )

        self.assertIsNotNone(df_list)
        self.assertTrue(len(df_list))

        self.assertEqual(df_list[0].shape, (4, 4))
        self.assertEqual(
            list(df_list[0].columns),
            ["name", "id", "version", "Company"],
        )

    def test_avro_reader(self):
        key = ROOT_PATH / "example.avro"

        df_list = fetch_dataframe(
            config_source=LocalConfig(),
            client=None,
            file_fqn=DatalakeTableSchemaWrapper(key=str(key), bucket_name="unused"),
        )

        self.assertIsNotNone(df_list)
        self.assertTrue(len(df_list))

        self.assertEqual(df_list[0].shape, (4, 8))
        self.assertEqual(
            list(df_list[0].columns),
            [
                "Boolean",
                "pdBoolean",
                "Float64",
                "Int64",
                "pdInt64",
                "String",
                "pdString",
                "DateTime64",
            ],
        )
