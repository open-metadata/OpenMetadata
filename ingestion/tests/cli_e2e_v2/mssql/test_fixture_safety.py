#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Real MSSQL isolation, read-only grants, and cleanup on setup failures."""

from contextlib import ExitStack

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from . import source as source_module
from .baseline import NATIVE_TABLE
from .source import fresh_mssql_source


def _rows(engine, statement, **parameters):
    with engine.connect() as connection:
        return connection.execute(text(statement), parameters).all()


def _assert_removed(engine, schema):
    assert _rows(engine, "SELECT name FROM sys.schemas WHERE name = :schema", schema=schema) == []


def test_sources_isolate_mutations_and_cleanup(mssql_admin_engine, mssql_ingestion_engine):
    with ExitStack() as cleanup:
        with fresh_mssql_source(mssql_admin_engine) as first:
            first.set_value("customers", 1, "credit_score", 999)
            first.drop_table(NATIVE_TABLE)
            second = cleanup.enter_context(fresh_mssql_source(mssql_admin_engine))
            assert first.schema != second.schema
            with pytest.raises(KeyError):
                first.drop_table(f"{second.schema}.{NATIVE_TABLE}")
            with pytest.raises(KeyError):
                first.set_value(f"{second.schema}.customers", 1, "credit_score", 1)
            with pytest.raises(ValueError, match="Expected one"):
                first.set_value("customers", 999, "credit_score", 1)
            quote = mssql_ingestion_engine.dialect.identifier_preparer.quote_identifier
            assert _rows(
                mssql_ingestion_engine, f"SELECT credit_score FROM {quote(second.schema)}.customers WHERE id = 1"
            ) == [(720,)]
            assert _rows(mssql_ingestion_engine, f"SELECT COUNT(*) FROM {quote(second.schema)}.{NATIVE_TABLE}") == [
                (1,)
            ]
        _assert_removed(mssql_admin_engine, first.schema)
        assert _rows(mssql_ingestion_engine, f"SELECT COUNT(*) FROM {quote(second.schema)}.customers") == [(5,)]
    _assert_removed(mssql_admin_engine, second.schema)


def test_ingestion_account_can_read_but_cannot_mutate(mssql_source, mssql_ingestion_engine):
    quote = mssql_ingestion_engine.dialect.identifier_preparer.quote_identifier
    owned = quote(mssql_source.schema)
    assert _rows(mssql_ingestion_engine, f"SELECT COUNT(*) FROM {owned}.customers") == [(5,)]
    with mssql_ingestion_engine.begin() as connection:
        with pytest.raises(DBAPIError, match="permission was denied"):
            connection.execute(text(f"UPDATE {owned}.customers SET credit_score = 1 WHERE id = 1"))
        connection.rollback()


def test_seed_failure_removes_owned_schema(mssql_admin_engine, monkeypatch):
    allocated = []
    seed = source_module._seed_source

    def fail_after_seed(source):
        allocated.append(source.schema)
        seed(source)
        raise RuntimeError("injected seed failure")

    monkeypatch.setattr(source_module, "_seed_source", fail_after_seed)
    with pytest.raises(RuntimeError, match="injected seed failure"), fresh_mssql_source(mssql_admin_engine):
        pytest.fail("Setup should not yield")
    assert len(allocated) == 1
    _assert_removed(mssql_admin_engine, allocated[0])
