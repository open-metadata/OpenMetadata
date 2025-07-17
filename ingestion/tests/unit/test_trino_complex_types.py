from unittest import TestCase

from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.trino.metadata import (
    parse_array_data_type,
    parse_row_data_type,
)

RAW_ARRAY_DATA_TYPES = [
    "array(string)",
    "array(row(check_datatype array(string)))",
]

EXPECTED_ARRAY_DATA_TYPES = [
    "array<string>",
    "array<struct<check_datatype:array<string>>>",
]

RAW_ROW_DATA_TYPES = [
    "row(a int, b string)",
    "row(a row(b array(string),c bigint))",
    "row(a array(string))",
    "row(bigquerytestdatatype51 array(row(bigquery_test_datatype_511 array(string))))",
    "row(record_1 row(record_2 row(record_3 row(record_4 string))))",
]

EXPECTED_ROW_DATA_TYPES = [
    "struct<a:int,b:string>",
    "struct<a:struct<b:array<string>,c:bigint>>",
    "struct<a:array<string>>",
    "struct<bigquerytestdatatype51:array<struct<bigquery_test_datatype_511:array<string>>>>",
    "struct<record_1:struct<record_2:struct<record_3:struct<record_4:string>>>>",
]

# Test cases for dataLength conversion - only for types that should have dataLength
DATA_LENGTH_TEST_CASES = [
    ("varchar(20)", 20),
    ("varchar(255)", 255),
    ("char(10)", 10),
    ("timestamp(3)", 3),
    ("timestamp(6)", 6),
    ("time(3)", 3),
]

# Test cases for non-numeric length values (should default to 1)
NON_NUMERIC_LENGTH_TEST_CASES = [
    ("varchar(abc)", 1),
    ("char(xyz)", 1),
    ("timestamp(precision)", 1),
]

# Test cases for types that should NOT have dataLength field
NO_DATA_LENGTH_TEST_CASES = [
    "varchar",  # No length specified
    "int",  # No length specified
    "bigint",  # No length specified
    "date",  # No length specified
    "timestamp",  # No length specified (without precision)
]


class SouceConnectionTest(TestCase):
    def test_array_datatype(self):
        for i in range(len(RAW_ARRAY_DATA_TYPES)):
            parsed_type = parse_array_data_type(RAW_ARRAY_DATA_TYPES[i])
            assert parsed_type == EXPECTED_ARRAY_DATA_TYPES[i]

    def test_row_datatype(self):
        for i in range(len(RAW_ROW_DATA_TYPES)):
            parsed_type = parse_row_data_type(RAW_ROW_DATA_TYPES[i])
            assert parsed_type == EXPECTED_ROW_DATA_TYPES[i]

    def test_data_length_conversion(self):
        """Test that dataLength is properly converted to integer for various data types"""
        parser = ColumnTypeParser()

        for dtype, expected_length in DATA_LENGTH_TEST_CASES:
            with self.subTest(dtype=dtype):
                result = parser._parse_primitive_datatype_string(dtype)
                self.assertIn("dataLength", result)
                self.assertIsInstance(result["dataLength"], int)
                self.assertEqual(result["dataLength"], expected_length)
                self.assertEqual(result["dataType"], dtype.split("(")[0].upper())

    def test_non_numeric_length_handling(self):
        """Test that non-numeric length values default to 1"""
        parser = ColumnTypeParser()

        for dtype, expected_length in NON_NUMERIC_LENGTH_TEST_CASES:
            with self.subTest(dtype=dtype):
                result = parser._parse_primitive_datatype_string(dtype)
                self.assertIn("dataLength", result)
                self.assertIsInstance(result["dataLength"], int)
                self.assertEqual(result["dataLength"], expected_length)
                self.assertEqual(result["dataType"], dtype.split("(")[0].upper())

    def test_no_data_length_for_simple_types(self):
        """Test that simple types without length specification don't have dataLength field"""
        parser = ColumnTypeParser()

        for dtype in NO_DATA_LENGTH_TEST_CASES:
            with self.subTest(dtype=dtype):
                result = parser._parse_primitive_datatype_string(dtype)
                # These types should not have dataLength field
                self.assertNotIn("dataLength", result)

    def test_data_length_type_safety(self):
        """Test that dataLength is always an integer type when present"""
        parser = ColumnTypeParser()

        test_dtypes = [
            "varchar(100)",
            "char(50)",
            "timestamp(3)",
            "decimal(10,2)",
        ]

        for dtype in test_dtypes:
            with self.subTest(dtype=dtype):
                result = parser._parse_primitive_datatype_string(dtype)
                # Verify dataLength is always an integer when present
                if "dataLength" in result:
                    self.assertIsInstance(result["dataLength"], int)
                    # Verify dataLength is never a string
                    self.assertNotIsInstance(result["dataLength"], str)
