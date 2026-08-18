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

from importlib import import_module
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects.oracle.base import OracleDialect

CONSTRAINT_ROWS = [
    (
        "FK_MY_TABLE_PARENT",
        "R",
        "PARENT_ID",
        "PARENT_TABLE",
        "ID",
        "PARENT_SCHEMA",
        1,
        1,
        None,
        "CASCADE",
        None,
    ),
    ("PK_MY_TABLE", "P", "ID", None, None, None, 1, None, None, None, "PK_MY_TABLE"),
    ("UQ_MY_TABLE_CODE", "U", "CODE", None, None, None, 1, None, None, None, "UQ_MY_TABLE_CODE"),
    ("UQ_MY_TABLE_CODE", "U", "REGION", None, None, None, 2, None, None, None, "UQ_MY_TABLE_CODE"),
]


def _dialect(prefix: str) -> OracleDialect:
    import_module("metadata.ingestion.source.database.oracle.metadata")
    dialect = OracleDialect()
    dialect.table_prefix = prefix  # type: ignore[attr-defined]
    return dialect


def _connection(rows):
    connection = MagicMock()
    connection.execute.return_value.fetchall.return_value = rows
    return connection


def _connection_with_synonyms(rows, synonyms):
    constraint_result = MagicMock()
    constraint_result.fetchall.return_value = rows
    synonym_result = MagicMock()
    synonym_result.mappings.return_value = synonyms
    connection = MagicMock()
    connection.execute.side_effect = [constraint_result, synonym_result]
    return connection


@pytest.mark.parametrize("prefix", ["DBA", "ALL"])
def test_constraint_reflection_uses_configured_catalog(prefix):
    dialect = _dialect(prefix)
    connection = _connection(CONSTRAINT_ROWS)

    assert dialect.get_pk_constraint(connection, "my_table", schema="my_schema") == {
        "constrained_columns": ["id"],
        "name": "pk_my_table",
    }
    assert dialect.get_unique_constraints(connection, "my_table", schema="my_schema") == [
        {
            "name": "uq_my_table_code",
            "column_names": ["code", "region"],
            "duplicates_index": "uq_my_table_code",
        }
    ]
    assert dialect.get_foreign_keys(connection, "my_table", schema="my_schema") == [
        {
            "name": "fk_my_table_parent",
            "constrained_columns": ["parent_id"],
            "referred_schema": "parent_schema",
            "referred_table": "parent_table",
            "referred_columns": ["id"],
            "options": {"ondelete": "CASCADE"},
        }
    ]

    assert len(connection.execute.call_args_list) == 3
    for call in connection.execute.call_args_list:
        query = str(call.args[0])
        assert f"FROM {prefix}_CONSTRAINTS" in query
        assert query.count(f"{prefix}_CONS_COLUMNS") == 2
        assert call.args[1] == {"table_name": "MY_TABLE", "owner": "MY_SCHEMA"}


def test_constraint_reflection_returns_empty_defaults():
    dialect = _dialect("DBA")
    connection = _connection([])

    assert dialect.get_pk_constraint(connection, "my_table", schema="my_schema") == {
        "constrained_columns": [],
        "name": None,
    }
    assert dialect.get_unique_constraints(connection, "my_table", schema="my_schema") == []
    assert dialect.get_foreign_keys(connection, "my_table", schema="my_schema") == []


def test_constraint_reflection_resolves_synonym_before_denormalizing():
    dialect = _dialect("DBA")
    dialect._get_synonyms = MagicMock(
        return_value=[
            SimpleNamespace(
                table_name="ACTUAL_TABLE",
                table_owner="ACTUAL_SCHEMA",
                db_link=None,
            )
        ]
    )
    connection = _connection(CONSTRAINT_ROWS)

    assert dialect.get_pk_constraint(
        connection,
        "alias_table",
        schema="alias_schema",
        oracle_resolve_synonyms=True,
    ) == {
        "constrained_columns": ["id"],
        "name": "pk_my_table",
    }
    dialect._get_synonyms.assert_called_once_with(
        connection,
        "alias_schema",
        ["alias_table"],
        "",
        info_cache=None,
    )
    assert connection.execute.call_args.args[1] == {
        "table_name": "ACTUAL_TABLE",
        "owner": "ACTUAL_SCHEMA",
    }


def test_constraint_reflection_denormalizes_when_synonym_is_not_found():
    dialect = _dialect("DBA")
    dialect._get_synonyms = MagicMock(return_value=[])
    connection = _connection(CONSTRAINT_ROWS)

    dialect.get_pk_constraint(
        connection,
        "my_table",
        schema="my_schema",
        oracle_resolve_synonyms=True,
    )

    assert connection.execute.call_args.args[1] == {
        "table_name": "MY_TABLE",
        "owner": "MY_SCHEMA",
    }


def test_foreign_key_reflection_resolves_referred_table_synonym():
    dialect = _dialect("DBA")
    dialect._get_synonyms = MagicMock(return_value=[])
    connection = _connection_with_synonyms(
        CONSTRAINT_ROWS,
        [
            {
                "owner": "PARENT_SCHEMA",
                "table_name": "PARENT_TABLE",
                "table_owner": "ALIAS_SCHEMA",
                "synonym_name": "PARENT_ALIAS",
            }
        ],
    )

    foreign_keys = dialect.get_foreign_keys(
        connection,
        "my_table",
        schema="my_schema",
        oracle_resolve_synonyms=True,
    )

    assert foreign_keys == [
        {
            "name": "fk_my_table_parent",
            "constrained_columns": ["parent_id"],
            "referred_schema": "alias_schema",
            "referred_table": "parent_alias",
            "referred_columns": ["id"],
            "options": {"ondelete": "CASCADE"},
        }
    ]
    assert len(connection.execute.call_args_list) == 2
    assert "all_synonyms" in str(connection.execute.call_args_list[1].args[0])


def test_foreign_key_reflection_preserves_target_without_referred_synonym():
    dialect = _dialect("DBA")
    dialect._get_synonyms = MagicMock(return_value=[])
    connection = _connection_with_synonyms(CONSTRAINT_ROWS, [])

    foreign_keys = dialect.get_foreign_keys(
        connection,
        "my_table",
        schema="my_schema",
        oracle_resolve_synonyms=True,
    )

    assert foreign_keys == [
        {
            "name": "fk_my_table_parent",
            "constrained_columns": ["parent_id"],
            "referred_schema": "parent_schema",
            "referred_table": "parent_table",
            "referred_columns": ["id"],
            "options": {"ondelete": "CASCADE"},
        }
    ]
    assert len(connection.execute.call_args_list) == 2


def test_foreign_key_reflection_batches_referred_synonym_lookup():
    dialect = _dialect("DBA")
    dialect._get_synonyms = MagicMock(return_value=[])
    constraint_rows = CONSTRAINT_ROWS + [
        (
            "FK_MY_TABLE_OTHER_PARENT",
            "R",
            "OTHER_PARENT_ID",
            "OTHER_PARENT_TABLE",
            "ID",
            "OTHER_PARENT_SCHEMA",
            1,
            1,
            None,
            "NO ACTION",
            None,
        )
    ]
    connection = _connection_with_synonyms(constraint_rows, [])

    dialect.get_foreign_keys(
        connection,
        "my_table",
        schema="my_schema",
        oracle_resolve_synonyms=True,
    )

    assert len(connection.execute.call_args_list) == 2
    synonym_query = connection.execute.call_args_list[1].args[0]
    assert set(next(iter(synonym_query.compile().params.values()))) == {
        "PARENT_SCHEMA",
        "OTHER_PARENT_SCHEMA",
    }
