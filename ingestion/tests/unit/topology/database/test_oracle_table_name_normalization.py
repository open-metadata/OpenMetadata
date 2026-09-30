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

"""Oracle table-name normalisation in get_table_names.

Guards the fix for silently dropped foreign keys: get_table_names used to return
the data dictionary's uppercase name while get_foreign_keys normalised
referred_table to lowercase, so the two never matched and tableConstraints came
back empty for every Oracle table.
"""

import types
from importlib import import_module
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects.oracle.base import OracleDialect

TABLE_ROWS = [("CUSTOMERS",), ("TRANSACTIONS",), ("ALL_TYPES",)]


def _dialect(*, preserve_identifier_case: bool) -> OracleDialect:
    utils = import_module("metadata.ingestion.source.database.oracle.utils")
    import_module("metadata.ingestion.source.database.oracle.metadata")
    dialect = OracleDialect()
    dialect.table_prefix = "DBA"  # type: ignore[attr-defined]
    dialect.preserve_identifier_case = preserve_identifier_case  # type: ignore[attr-defined]
    if preserve_identifier_case:
        # Mirrors OracleSource.set_inspector, which binds the preserve-case variants.
        dialect.normalize_name = types.MethodType(utils.normalize_name, dialect)
        dialect.denormalize_name = types.MethodType(utils.denormalize_name, dialect)
    return dialect


def _connection(rows):
    connection = MagicMock()
    connection.execute.return_value = rows
    return connection


@pytest.mark.parametrize(
    "preserve_identifier_case, expected",
    [
        (False, ["customers", "transactions", "all_types"]),
        (True, ["CUSTOMERS", "TRANSACTIONS", "ALL_TYPES"]),
    ],
    ids=["default-normalises", "preserve-identifier-case-keeps-verbatim"],
)
def test_get_table_names_honours_identifier_case(preserve_identifier_case, expected):
    """Default folds dictionary names to lowercase; preserveIdentifierCase keeps them verbatim."""
    dialect = _dialect(preserve_identifier_case=preserve_identifier_case)

    assert dialect.get_table_names(_connection(TABLE_ROWS), schema="my_schema") == expected


def test_get_table_names_matches_foreign_key_referred_table():
    """The normalised table name matches what get_foreign_keys reports as referred_table.

    This is the pairing that broke: a mismatch here means every Oracle foreign key
    is dropped during ingestion, with no error and a reported 100% success.
    """
    dialect = _dialect(preserve_identifier_case=False)

    names = dialect.get_table_names(_connection([("CUSTOMERS",)]), schema="my_schema")

    # get_foreign_keys builds referred_table through the same normalize_name.
    assert names == [dialect.normalize_name("CUSTOMERS")]
