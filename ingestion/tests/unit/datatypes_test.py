import unittest
from unittest import TestCase

from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.column_helpers import get_column_type

SQLTYPES = [
    "ARRAY",
    "BIGINT",
    "BIGNUMERIC",
    "BINARY",
    "BIT",
    "BLOB",
    "BOOL",
    "BOOLEAN",
    "BPCHAR",
    "BYTEINT",
    "BYTES",
    "CHAR",
    "CHARACTER VARYING",
    "CHARACTER",
    "DATE",
    "DATETIME",
    "DATETIME2",
    "DATETIMEOFFSET",
    "DECIMAL",
    "DOUBLE PRECISION",
    "DOUBLE",
    "ENUM",
    "FLOAT",
    "FLOAT4",
    "FLOAT64",
    "FLOAT8",
    "GEOGRAPHY",
    "IMAGE",
    "INT",
    "INT2",
    "INT4",
    "INT64",
    "INT8",
    "INTEGER",
    "INTERVAL DAY TO SECOND",
    "INTERVAL YEAR TO MONTH",
    "INTERVAL",
    "JSON",
    "LONG VARCHAR",
    "LONG",
    "LONGBLOB",
    "MAP",
    "MEDIUMBLOB",
    "MEDIUMINT",
    "MEDIUMTEXT",
    "NCHAR",
    "NTEXT",
    "NUMBER",
    "NUMERIC",
    "NVARCHAR",
    "OBJECT",
    "REAL",
    "SET",
    "SMALLDATETIME",
    "SMALLINT",
    "STRING",
    "STRUCT",
    "TEXT",
    "TIME",
    "TIMESTAMP WITHOUT TIME ZONE",
    "TIMESTAMP",
    "TIMESTAMPTZ",
    "TIMETZ",
    "TINYINT",
    "UNION",
    "VARBINARY",
    "VARCHAR",
    "VARIANT",
    "YEAR",
]


class DataTypeTest(TestCase):
    def test_check_datatype_support(self):
        status = SQLSourceStatus()
        for types in SQLTYPES:
            with self.subTest(line=types):
                col_type = get_column_type(status, "Unit Test", types)
                col_type = True if col_type != "NULL" else False
                self.assertTrue(col_type, msg=types)
