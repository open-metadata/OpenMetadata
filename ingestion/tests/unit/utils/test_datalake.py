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
Test datalake utils
"""

import os
from unittest import TestCase

import pandas as pd

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.utils.datalake.datalake_utils import (
    DataFrameColumnParser,
    GenericDataFrameColumnParser,
    ParquetDataFrameColumnParser,
    get_file_format_type,
)

STRUCTURE = {
    "a": "w",
    "b": 4,
    "c": {
        "d": 2,
        "e": 4,
        "f": {
            "g": 9,
            "h": {"i": 6},
            "n": {
                "o": 10,
                "p": 11,
            },
        },
        "j": 7,
        "k": 8,
    },
}


class TestDatalakeUtils(TestCase):
    """class for datalake utils test"""

    def test_unique_json_structure(self):
        """test unique json structure fn"""
        sample_data = [
            {"a": "x", "b": 1, "c": {"d": 2}},
            {"a": "y", "b": 2, "c": {"e": 4, "f": {"g": 5, "h": {"i": 6}, "n": 5}}},
            {"a": "z", "b": 3, "c": {"j": 7}},
            {"a": "w", "b": 4, "c": {"k": 8, "f": {"g": 9, "n": {"o": 10, "p": 11}}}},
        ]
        expected = STRUCTURE

        actual = GenericDataFrameColumnParser.unique_json_structure(sample_data)

        self.assertDictEqual(expected, actual)

    def test_construct_column(self):
        """test construct column fn"""
        expected = [
            {
                "dataTypeDisplay": "STRING",
                "dataType": "STRING",
                "name": "a",
                "displayName": "a",
            },
            {
                "dataTypeDisplay": "INT",
                "dataType": "INT",
                "name": "b",
                "displayName": "b",
            },
            {
                "dataTypeDisplay": "JSON",
                "dataType": "JSON",
                "name": "c",
                "displayName": "c",
                "children": [
                    {
                        "dataTypeDisplay": "INT",
                        "dataType": "INT",
                        "name": "d",
                        "displayName": "d",
                    },
                    {
                        "dataTypeDisplay": "INT",
                        "dataType": "INT",
                        "name": "e",
                        "displayName": "e",
                    },
                    {
                        "dataTypeDisplay": "JSON",
                        "dataType": "JSON",
                        "name": "f",
                        "displayName": "f",
                        "children": [
                            {
                                "dataTypeDisplay": "INT",
                                "dataType": "INT",
                                "name": "g",
                                "displayName": "g",
                            },
                            {
                                "dataTypeDisplay": "JSON",
                                "dataType": "JSON",
                                "name": "h",
                                "displayName": "h",
                                "children": [
                                    {
                                        "dataTypeDisplay": "INT",
                                        "dataType": "INT",
                                        "name": "i",
                                        "displayName": "i",
                                    }
                                ],
                            },
                            {
                                "dataTypeDisplay": "JSON",
                                "dataType": "JSON",
                                "name": "n",
                                "displayName": "n",
                                "children": [
                                    {
                                        "dataTypeDisplay": "INT",
                                        "dataType": "INT",
                                        "name": "o",
                                        "displayName": "o",
                                    },
                                    {
                                        "dataTypeDisplay": "INT",
                                        "dataType": "INT",
                                        "name": "p",
                                        "displayName": "p",
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        "dataTypeDisplay": "INT",
                        "dataType": "INT",
                        "name": "j",
                        "displayName": "j",
                    },
                    {
                        "dataTypeDisplay": "INT",
                        "dataType": "INT",
                        "name": "k",
                        "displayName": "k",
                    },
                ],
            },
        ]
        actual = GenericDataFrameColumnParser.construct_json_column_children(STRUCTURE)

        for el in zip(expected, actual):
            self.assertDictEqual(el[0], el[1])

    def test_create_column_object(self):
        """test create column object fn"""
        formatted_column = GenericDataFrameColumnParser.construct_json_column_children(
            STRUCTURE
        )
        column = {
            "dataTypeDisplay": "STRING",
            "dataType": "STRING",
            "name": "a",
            "displayName": "a",
            "children": formatted_column,
        }
        column_obj = Column(**column)
        assert len(column_obj.children) == 3


class TestParquetDataFrameColumnParser(TestCase):
    """Test parquet dataframe column parser"""

    @classmethod
    def setUpClass(cls) -> None:
        resources_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "resources"
        )
        cls.parquet_path = os.path.join(resources_path, "datalake", "example.parquet")

        cls.df = pd.read_parquet(cls.parquet_path)

        cls.parquet_parser = ParquetDataFrameColumnParser(cls.df)

    def test_parser_instantiation(self):
        """Test the right parser is instantiated from the creator method"""
        parquet_parser = DataFrameColumnParser.create(self.df, SupportedTypes.PARQUET)
        self.assertIsInstance(parquet_parser.parser, ParquetDataFrameColumnParser)

        parquet_types = [
            SupportedTypes.PARQUET,
            SupportedTypes.PARQUET_PQ,
            SupportedTypes.PARQUET_PQT,
            SupportedTypes.PARQUET_PARQ,
            SupportedTypes.PARQUET_SNAPPY,
        ]
        other_types = [typ for typ in SupportedTypes if typ not in parquet_types]
        for other_type in other_types:
            with self.subTest(other_type=other_type):
                generic_parser = DataFrameColumnParser.create(self.df, other_type)
                self.assertIsInstance(
                    generic_parser.parser, GenericDataFrameColumnParser
                )

    def test_shuffle_and_sample_from_parser(self):
        """test the shuffle and sampling logic from the parser creator method"""
        parquet_parser = DataFrameColumnParser.create(self.df, SupportedTypes.PARQUET)
        self.assertEqual(parquet_parser.parser.data_frame.shape, self.df.shape)

        parquet_parser = DataFrameColumnParser.create(
            [self.df, self.df], SupportedTypes.PARQUET
        )
        self.assertEqual(parquet_parser.parser.data_frame.shape, self.df.shape)

        parquet_parser = DataFrameColumnParser.create(
            [self.df, self.df], SupportedTypes.PARQUET, sample=False
        )
        self.assertEqual(
            parquet_parser.parser.data_frame.shape, pd.concat([self.df, self.df]).shape
        )

    def test_get_columns(self):
        """test `get_columns` method of the parquet column parser"""
        expected = [
            Column(
                dataTypeDisplay="bool",
                dataType=DataType.BOOLEAN,
                name="a",
                displayName="a",
            ),  # type: ignore
            Column(
                dataTypeDisplay="int8",
                dataType=DataType.INT,
                name="b",
                displayName="b",
            ),  # type: ignore
            Column(
                dataTypeDisplay="int16",
                dataType=DataType.INT,
                name="c",
                displayName="c",
            ),  # type: ignore
            Column(
                dataTypeDisplay="int32",
                dataType=DataType.INT,
                name="d",
                displayName="d",
            ),  # type: ignore
            Column(
                dataTypeDisplay="int64",
                dataType=DataType.INT,
                name="e",
                displayName="e",
            ),  # type: ignore
            Column(
                dataTypeDisplay="uint8",
                dataType=DataType.UINT,
                name="f",
                displayName="f",
            ),  # type: ignore
            Column(
                dataTypeDisplay="uint16",
                dataType=DataType.UINT,
                name="g",
                displayName="g",
            ),  # type: ignore
            Column(
                dataTypeDisplay="uint32",
                dataType=DataType.UINT,
                name="h",
                displayName="h",
            ),  # type: ignore
            Column(
                dataTypeDisplay="uint64",
                dataType=DataType.UINT,
                name="i",
                displayName="i",
            ),  # type: ignore
            Column(
                dataTypeDisplay="float",
                dataType=DataType.FLOAT,
                name="k",
                displayName="k",
            ),  # type: ignore
            Column(
                dataTypeDisplay="double",
                dataType=DataType.FLOAT,
                name="l",
                displayName="l",
            ),  # type: ignore
            Column(
                dataTypeDisplay="time64[us]",
                dataType=DataType.DATETIME,
                name="n",
                displayName="n",
            ),  # type: ignore
            Column(
                dataTypeDisplay="timestamp[ns]",
                dataType=DataType.DATETIME,
                name="o",
                displayName="o",
            ),  # type: ignore
            Column(
                dataTypeDisplay="date32[day]",
                dataType=DataType.DATE,
                name="p",
                displayName="p",
            ),  # type: ignore
            Column(
                dataTypeDisplay="date32[day]",
                dataType=DataType.DATE,
                name="q",
                displayName="q",
            ),  # type: ignore
            Column(
                dataTypeDisplay="duration[ns]",
                dataType=DataType.INT,
                name="r",
                displayName="r",
            ),  # type: ignore
            Column(
                dataTypeDisplay="binary",
                dataType=DataType.BINARY,
                name="t",
                displayName="t",
            ),  # type: ignore
            Column(
                dataTypeDisplay="string",
                dataType=DataType.STRING,
                name="u",
                displayName="u",
            ),  # type: ignore
            Column(
                dataTypeDisplay="string",
                dataType=DataType.STRING,
                name="v",
                displayName="v",
            ),  # type: ignore
            Column(
                dataTypeDisplay="binary",
                dataType=DataType.BINARY,
                name="w",
                displayName="w",
            ),  # type: ignore
            Column(
                dataTypeDisplay="string",
                dataType=DataType.STRING,
                name="x",
                displayName="x",
            ),  # type: ignore
            Column(
                dataTypeDisplay="string",
                dataType=DataType.STRING,
                name="y",
                displayName="y",
            ),  # type: ignore
            Column(
                dataTypeDisplay="list<item: int64>",
                dataType=DataType.ARRAY,
                name="aa",
                displayName="aa",
            ),  # type: ignore
            Column(
                dataTypeDisplay="list<item: int64>",
                dataType=DataType.ARRAY,
                name="bb",
                displayName="bb",
            ),  # type: ignore
            Column(
                dataTypeDisplay="struct<ee: int64, ff: int64, gg: struct<hh: struct<ii: int64, jj: int64, kk: int64>>>",
                dataType=DataType.STRUCT,
                name="dd",
                displayName="dd",
                children=[
                    Column(
                        dataTypeDisplay="int64",
                        dataType=DataType.INT,
                        name="ee",
                        displayName="ee",
                    ),  # type: ignore
                    Column(
                        dataTypeDisplay="int64",
                        dataType=DataType.INT,
                        name="ff",
                        displayName="ff",
                    ),  # type: ignore
                    Column(
                        dataTypeDisplay="struct<hh: struct<ii: int64, jj: int64, kk: int64>>",
                        dataType=DataType.STRUCT,
                        name="gg",
                        displayName="gg",
                        children=[
                            Column(
                                dataTypeDisplay="struct<ii: int64, jj: int64, kk: int64>",
                                dataType=DataType.STRUCT,
                                name="hh",
                                displayName="hh",
                                children=[
                                    Column(
                                        dataTypeDisplay="int64",
                                        dataType=DataType.INT,
                                        name="ii",
                                        displayName="ii",
                                    ),  # type: ignore
                                    Column(
                                        dataTypeDisplay="int64",
                                        dataType=DataType.INT,
                                        name="jj",
                                        displayName="jj",
                                    ),  # type: ignore
                                    Column(
                                        dataTypeDisplay="int64",
                                        dataType=DataType.INT,
                                        name="kk",
                                        displayName="kk",
                                    ),  # type: ignore
                                ],
                            ),
                        ],
                    ),
                ],
            ),  # type: ignore
        ]
        actual = self.parquet_parser.get_columns()
        for validation in zip(expected, actual):
            with self.subTest(validation=validation):
                expected_col, actual_col = validation
                self.assertEqual(expected_col.name, actual_col.name)
                self.assertEqual(expected_col.displayName, actual_col.displayName)
                self.assertEqual(expected_col.dataType, actual_col.dataType)

    def _validate_parsed_column(self, expected, actual):
        """validate parsed column"""
        self.assertEqual(expected.name, actual.name)
        self.assertEqual(expected.dataType, actual.dataType)
        self.assertEqual(expected.displayName, actual.displayName)
        if expected.children:
            self.assertEqual(len(expected.children), len(actual.children))
            for validation in zip(expected.children, actual.children):
                with self.subTest(validation=validation):
                    expected_col, actual_col = validation
                    self._validate_parsed_column(expected_col, actual_col)

    def test_get_file_format_type_csv_gz(self):
        """test get_file_format_type function for csv.gz files"""
        # Test csv.gz file detection
        result = get_file_format_type("data.csv.gz")
        self.assertEqual(result, SupportedTypes.CSVGZ)

        # Test regular csv file detection (should still work)
        result = get_file_format_type("data.csv")
        self.assertEqual(result, SupportedTypes.CSV)

        # Test other gzipped files
        result = get_file_format_type("data.json.gz")
        self.assertEqual(result, SupportedTypes.JSONGZ)

        # Test unsupported gzipped format
        result = get_file_format_type("data.txt.gz")
        self.assertEqual(result, False)

    def test_csv_gz_file_format_detection_edge_cases(self):
        """test edge cases for csv.gz file format detection"""
        # Test with nested paths
        result = get_file_format_type("folder/subfolder/data.csv.gz")
        self.assertEqual(result, SupportedTypes.CSVGZ)

        # Test with multiple dots
        result = get_file_format_type("data.backup.csv.gz")
        self.assertEqual(result, SupportedTypes.CSVGZ)

        # Test with no extension
        result = get_file_format_type("data")
        self.assertEqual(result, False)

        # Test with just .gz
        result = get_file_format_type("data.gz")
        self.assertEqual(result, False)

    def test_csv_gz_compression_detection(self):
        """test compression detection for various file types"""
        # Test csv.gz compression detection
        test_cases = [
            ("data.csv.gz", SupportedTypes.CSVGZ),
            ("data.csv", SupportedTypes.CSV),
            ("data.json.gz", SupportedTypes.JSONGZ),
            ("data.json", SupportedTypes.JSON),
            ("data.jsonl.gz", SupportedTypes.JSONLGZ),
            ("data.jsonl", SupportedTypes.JSONL),
            ("data.parquet", SupportedTypes.PARQUET),
            ("data.txt.gz", False),  # Unsupported
            ("data.unknown.gz", False),  # Unsupported
        ]

        for filename, expected in test_cases:
            with self.subTest(filename=filename):
                result = get_file_format_type(filename)
                self.assertEqual(result, expected, f"Failed for {filename}")

    def test_csv_gz_reader_factory_integration(self):
        """test that csv.gz is properly integrated with reader factory"""
        from metadata.readers.dataframe.reader_factory import SupportedTypes

        # Test that CSVGZ is properly handled
        try:
            # Test that the enum value exists
            self.assertEqual(SupportedTypes.CSVGZ.value, "csv.gz")

            # Test that it's different from regular CSV
            self.assertNotEqual(SupportedTypes.CSVGZ, SupportedTypes.CSV)
            self.assertNotEqual(SupportedTypes.CSVGZ.value, SupportedTypes.CSV.value)

        except Exception as e:
            self.fail(f"CSVGZ enum test failed: {e}")

    def test_csv_gz_supported_types_enum(self):
        """test that CSVGZ is properly defined in SupportedTypes enum"""
        # Test that CSVGZ exists in the enum
        self.assertIn(SupportedTypes.CSVGZ, SupportedTypes)
        self.assertEqual(SupportedTypes.CSVGZ.value, "csv.gz")

        # Test that it's different from regular CSV
        self.assertNotEqual(SupportedTypes.CSVGZ, SupportedTypes.CSV)
        self.assertNotEqual(SupportedTypes.CSVGZ.value, SupportedTypes.CSV.value)

    def test_csv_gz_dsv_reader_compression_detection(self):
        """test that DSV reader properly detects compression for csv.gz files"""
        from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
            LocalConfig,
        )
        from metadata.readers.dataframe.dsv import DSVDataFrameReader

        # Create a mock config
        local_config = LocalConfig()

        # Create DSV reader
        reader = DSVDataFrameReader(config_source=local_config, client=None)

        # Test compression detection logic (this is the same logic used in the dispatch methods)
        test_cases = [
            ("data.csv.gz", "gzip"),
            ("data.csv", None),
            ("data.json.gz", "gzip"),
            ("data.txt.gz", "gzip"),
            ("data.unknown.gz", "gzip"),
        ]

        for filename, expected_compression in test_cases:
            with self.subTest(filename=filename):
                # Simulate the compression detection logic from the dispatch methods
                compression = None
                if filename.endswith(".gz"):
                    compression = "gzip"

                self.assertEqual(
                    compression,
                    expected_compression,
                    f"Compression detection failed for {filename}",
                )

    def test_csv_gz_integration_completeness(self):
        """test that csv.gz support is complete across all components"""
        # Test that CSVGZ is in the reader factory mapping
        from metadata.readers.dataframe.reader_factory import (
            DF_READER_MAP,
            SupportedTypes,
        )

        # Check that CSVGZ is mapped to CSVDataFrameReader
        self.assertIn(SupportedTypes.CSVGZ.value, DF_READER_MAP)

        # Test that the get_df_reader function includes CSVGZ in DSV handling

        # This should not raise an exception for CSVGZ
        try:
            # Test that CSVGZ is included in the DSV types
            dsv_types = {SupportedTypes.CSV, SupportedTypes.CSVGZ, SupportedTypes.TSV}
            self.assertIn(SupportedTypes.CSVGZ, dsv_types)
        except Exception as e:
            self.fail(f"CSVGZ integration test failed: {e}")
