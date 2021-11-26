import unittest
from unittest import TestCase

from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.source.sql_source import SQLSourceStatus
from metadata.utils.column_helpers import get_column_type

sqltypes = [
    "INT",
    "INT2",
    "INT4",
    "BOOLEAN",
    "BOOL",
    "ENUM",
    "BYTES",
    "ARRAY",
    "BPCHAR",
    "VARCHAR",
    "STRING",
    "DATE",
    "TIME",
    "DATETIME",
    "TIMESTAMP",
    "JSON",
    "CHAR",
    "INT64",
    "CHARACTER VARYING",
    "VARIANT",
    "OBJECT",
    "MAP",
    "UNION",
    "BIGINT",
    "INTEGER",
    "TIMESTAMP WITHOUT TIME ZONE",
    "FLOAT64",
    "DECIMAL",
    "DOUBLE",
    "NUMERIC",
    "INTERVAL",
    "SET",
    "BINARY",
    "SMALLINT",
    "TINYINT",
    "NUMBER",
    "BYTEINT",
    "FLOAT",
    "MEDIUMTEXT",
    "TEXT",
    "VARBINARY",
    "BLOB",
    "LONGBLOB",
    "MEDIUMBLOB",
    "STRUCT",
    "GEOGRAPHY",
    "REAL",
    "FLOAT4",
    "DOUBLE PRECISION",
    "FLOAT8",
    "CHARACTER",
    "NCHAR",
    "NVARCHAR",
]


class DataTypeTest(TestCase):
    def test_check_datatype_support(self):
        status = SQLSourceStatus()
        for types in sqltypes:
            with self.subTest(line=types):
                col_type = get_column_type(status, "Unit Test", types)
                col_type = True if col_type != "NULL" else False
                self.assertTrue(col_type, msg=f"{types}")
