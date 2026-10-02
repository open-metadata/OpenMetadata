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

"""Oracle foreign-key referred_table casing.

Guards the fix for silently dropped foreign keys. get_table_names returns the data
dictionary's name verbatim (uppercase for unquoted identifiers), so the Table entity
is created as schema.CUSTOMERS. get_foreign_keys must report referred_table in that
same case, or common_db_source's exact get_by_name lookup misses and the constraint
is discarded with no error and a reported 100% success.
"""

import types
from importlib import import_module
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects.oracle.base import OracleDialect


# (constraint_name, constraint_type, local_column, remote_table, remote_column,
#  remote_owner, position, ...) as ORACLE_CONSTRAINTS returns them.
def _fk_rows(remote_table: str):
    return [
        (
            "FK_TRANSACTIONS_CUSTOMERS",
            "R",
            "CUSTOMER_ID",
            remote_table,
            "ID",
            "E2E_SCHEMA",
            1,
            1,
            None,
            "NO ACTION",
            None,
        ),
    ]


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
    connection.execute.return_value.fetchall.return_value = rows
    return connection


@pytest.mark.parametrize(
    "preserve_identifier_case, expected_columns",
    [
        (False, ("customer_id", "id")),
        (True, ("CUSTOMER_ID", "ID")),
    ],
    ids=["default", "preserve-identifier-case"],
)
def test_referred_table_matches_get_table_names_case(preserve_identifier_case, expected_columns):
    """referred_table matches the case get_table_names uses, in both identifier modes.

    Columns follow normalize_name and so differ between modes; the table name must not,
    because it has to match the Table entity's FQN either way.
    """
    dialect = _dialect(preserve_identifier_case=preserve_identifier_case)

    keys = dialect.get_foreign_keys(_connection(_fk_rows("CUSTOMERS")), "transactions", schema="e2e_schema")

    assert len(keys) == 1, f"expected one foreign key, got {keys!r}"
    # get_table_names returns row[0] verbatim, so the entity is created as CUSTOMERS.
    assert keys[0]["referred_table"] == "CUSTOMERS"
    local, referred = expected_columns
    assert keys[0]["constrained_columns"] == [local]
    assert keys[0]["referred_columns"] == [referred]


@pytest.mark.parametrize(
    "stored_name",
    ["CUSTOMERS", "customers", "MixedCase"],
    ids=["unquoted-upper", "quoted-lower", "quoted-mixed"],
)
def test_referred_table_is_reported_verbatim(stored_name):
    """Whatever the dictionary holds is what referred_table reports.

    A table created with a quoted lowercase name is stored lowercase, and
    get_table_names returns it unchanged, so the FK must not fold its case either
    way. Passing the value through verbatim keeps that true without depending on
    normalize_name/denormalize_name round-tripping.
    """
    dialect = _dialect(preserve_identifier_case=False)

    keys = dialect.get_foreign_keys(_connection(_fk_rows(stored_name)), "transactions", schema="e2e_schema")

    assert keys[0]["referred_table"] == stored_name
