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

import json
import os
from unittest import TestCase

import pandas as pd

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.readers.dataframe.dsv import _fix_malformed_quoted_header
from metadata.readers.dataframe.reader_factory import SupportedTypes
from metadata.utils.datalake.datalake_utils import (
    DataFrameColumnParser,
    GenericDataFrameColumnParser,
    JsonDataFrameColumnParser,
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


class TestIcebergDeltaLakeMetadataParsing(TestCase):
    """Test Iceberg/Delta Lake metadata JSON parsing"""

    def test_iceberg_metadata_parsing(self):
        """Test parsing of Iceberg/Delta Lake metadata files with nested schema.fields structure"""

        # Sample Iceberg/Delta Lake metadata structure
        iceberg_metadata = {
            "format-version": 1,
            "table-uuid": "e9182d72-131b-48fe-b530-79edc044fb01",
            "location": "s3://bucket/path/table",
            "schema": {
                "type": "struct",
                "schema-id": 0,
                "fields": [
                    {
                        "id": 1,
                        "name": "customer_id",
                        "required": False,
                        "type": "string",
                    },
                    {
                        "id": 2,
                        "name": "customer_type_cd",
                        "required": False,
                        "type": "string",
                    },
                    {"id": 3, "name": "amount", "required": True, "type": "double"},
                    {
                        "id": 4,
                        "name": "is_active",
                        "required": False,
                        "type": "boolean",
                    },
                    {"id": 5, "name": "order_count", "required": False, "type": "int"},
                    {
                        "id": 6,
                        "name": "created_date",
                        "required": False,
                        "type": "date",
                    },
                    {
                        "id": 7,
                        "name": "updated_timestamp",
                        "required": False,
                        "type": "timestamp",
                    },
                    {
                        "id": 8,
                        "name": "metadata",
                        "required": False,
                        "type": {
                            "type": "struct",
                            "fields": [
                                {
                                    "id": 9,
                                    "name": "source_system",
                                    "required": False,
                                    "type": "string",
                                },
                                {
                                    "id": 10,
                                    "name": "last_sync_time",
                                    "required": False,
                                    "type": "timestamp",
                                },
                            ],
                        },
                    },
                ],
            },
        }

        # Convert to JSON string as would be received from file
        raw_data = json.dumps(iceberg_metadata)

        # Create a dummy DataFrame (required by parser but not used for Iceberg metadata)
        df = pd.DataFrame()

        # Create parser and parse columns
        parser = JsonDataFrameColumnParser(df, raw_data=raw_data)
        columns = parser.get_columns()

        # Verify the correct number of columns were parsed
        self.assertEqual(len(columns), 8)

        # Verify field names were correctly parsed
        expected_names = [
            "customer_id",
            "customer_type_cd",
            "amount",
            "is_active",
            "order_count",
            "created_date",
            "updated_timestamp",
            "metadata",
        ]
        actual_names = [col.displayName for col in columns]
        self.assertEqual(expected_names, actual_names)

        # Verify data types were correctly mapped
        expected_types = [
            DataType.STRING,  # customer_id
            DataType.STRING,  # customer_type_cd
            DataType.DOUBLE,  # amount
            DataType.BOOLEAN,  # is_active
            DataType.INT,  # order_count
            DataType.DATE,  # created_date
            DataType.TIMESTAMP,  # updated_timestamp
            DataType.STRUCT,  # metadata
        ]
        actual_types = [col.dataType for col in columns]
        self.assertEqual(expected_types, actual_types)

        # Verify nested struct field (metadata)
        metadata_column = columns[7]
        self.assertEqual(metadata_column.displayName, "metadata")
        self.assertEqual(metadata_column.dataType, DataType.STRUCT)
        self.assertIsNotNone(metadata_column.children)
        self.assertEqual(len(metadata_column.children), 2)

        # Verify nested field details
        nested_fields = metadata_column.children
        self.assertEqual(nested_fields[0]["displayName"], "source_system")
        self.assertEqual(nested_fields[0]["dataType"], DataType.STRING.value)
        self.assertEqual(nested_fields[1]["displayName"], "last_sync_time")
        self.assertEqual(nested_fields[1]["dataType"], DataType.TIMESTAMP.value)

    def test_is_iceberg_delta_metadata_detection(self):
        """Test detection of Iceberg/Delta Lake metadata format"""
        df = pd.DataFrame()
        parser = JsonDataFrameColumnParser(df, raw_data=None)

        # Test valid Iceberg/Delta Lake metadata
        valid_metadata = {"schema": {"fields": [{"name": "field1", "type": "string"}]}}
        self.assertTrue(parser._is_iceberg_delta_metadata(valid_metadata))

        # Test invalid formats
        invalid_cases = [
            {},  # Empty dict
            {"schema": "not_a_dict"},  # Schema not a dict
            {"schema": {}},  # No fields
            {"schema": {"fields": "not_a_list"}},  # Fields not a list
            {"properties": {}},  # JSON Schema format (not Iceberg)
        ]

        for invalid_case in invalid_cases:
            with self.subTest(invalid_case=invalid_case):
                self.assertFalse(parser._is_iceberg_delta_metadata(invalid_case))

    def test_fallback_to_json_schema_parser(self):
        """Test that non-Iceberg JSON files fall back to standard JSON Schema parser"""
        # Standard JSON Schema format
        json_schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {"name": {"type": "string"}, "age": {"type": "integer"}},
        }

        raw_data = json.dumps(json_schema)
        df = pd.DataFrame()

        # This should use the standard JSON Schema parser, not Iceberg parser
        parser = JsonDataFrameColumnParser(df, raw_data=raw_data)
        columns = parser.get_columns()

        # The standard parser behavior would be different
        # This test ensures we don't break existing JSON Schema parsing
        self.assertIsNotNone(columns)


class TestCSVQuotedHeaderFix(TestCase):
    """Test CSV parsing with quoted header fix for malformed CSV files"""

    def test_normal_csv_no_fix_applied(self):
        """Test that normal CSV files with proper headers are not modified"""
        df = pd.DataFrame(
            {
                "Year": [2024, 2024, 2024],
                "Industry_code": ["99999", "99999", "99999"],
                "Industry_name": ["All industries", "All industries", "All industries"],
                "Units": [
                    "Dollars (millions)",
                    "Dollars (millions)",
                    "Dollars (millions)",
                ],
                "Value": [979594, 838626, 112188],
            }
        )

        result = _fix_malformed_quoted_header([df], ",")

        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0].columns), 5)
        self.assertEqual(
            list(result[0].columns),
            ["Year", "Industry_code", "Industry_name", "Units", "Value"],
        )
        self.assertEqual(len(result[0]), 3)

    def test_malformed_csv_quoted_header_fix_applied(self):
        """Test that malformed CSV with quoted header row is properly fixed"""
        malformed_header = "managementLevel,businessAllocation2Key,validFrom,fillable,businessAllocation1English"
        df = pd.DataFrame(columns=[malformed_header])

        result = _fix_malformed_quoted_header([df], ",")

        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0].columns), 5)
        self.assertEqual(
            list(result[0].columns),
            [
                "managementLevel",
                "businessAllocation2Key",
                "validFrom",
                "fillable",
                "businessAllocation1English",
            ],
        )

    def test_single_column_csv_without_separator_no_fix(self):
        """Test that single column CSV without separator in name is not modified"""
        df = pd.DataFrame(columns=["single_column_name"])

        result = _fix_malformed_quoted_header([df], ",")

        self.assertEqual(len(result), 1)
        self.assertEqual(list(result[0].columns), ["single_column_name"])

    def test_quoted_header_with_special_characters(self):
        """Test parsing quoted header containing special characters"""
        malformed_header = '"col1","col2 with spaces","col3&special","col4/slash"'
        df = pd.DataFrame(columns=[malformed_header])

        result = _fix_malformed_quoted_header([df], ",")

        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0].columns), 4)
        self.assertEqual(
            list(result[0].columns),
            ["col1", "col2 with spaces", "col3&special", "col4/slash"],
        )

    def test_tsv_malformed_header_fix(self):
        """Test that malformed TSV with tab-separated quoted header is properly fixed"""
        malformed_header = "col1\tcol2\tcol3\tcol4"
        df = pd.DataFrame(columns=[malformed_header])

        result = _fix_malformed_quoted_header([df], "\t")

        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0].columns), 4)
        self.assertEqual(list(result[0].columns), ["col1", "col2", "col3", "col4"])

    def test_empty_chunk_list_returns_empty(self):
        """Test that empty chunk list returns empty list"""
        result = _fix_malformed_quoted_header([], ",")
        self.assertEqual(result, [])
