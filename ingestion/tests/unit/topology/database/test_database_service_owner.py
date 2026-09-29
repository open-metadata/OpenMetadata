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
Tests for DatabaseServiceSource.get_owner_ref source-owner extraction.

The Postgres source monkeypatches ``Inspector.get_table_owner`` onto SQLAlchemy's
global ``Inspector`` class, and importing anything under ``metadata`` pulls that
module in. Probing the inspector for the method therefore always succeeds, on
every connector, so these tests exercise the guard with real SQLAlchemy dialects
rather than mocks.
"""

import logging
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects.mssql.pyodbc import MSDialect_pyodbc
from sqlalchemy.dialects.mysql.pymysql import MySQLDialect_pymysql
from sqlalchemy.dialects.oracle.cx_oracle import OracleDialect_cx_oracle
from sqlalchemy.dialects.postgresql.psycopg2 import PGDialect_psycopg2
from sqlalchemy.engine.reflection import Inspector

import metadata.ingestion.source.database.postgres.metadata  # noqa: F401  (applies the global patch)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.ingestion.source.database.database_service import DatabaseServiceSource

NON_POSTGRES_DIALECTS = [
    MySQLDialect_pymysql,
    MSDialect_pyodbc,
    OracleDialect_cx_oracle,
]


def make_source(dialect_class, include_owners=True):
    """Build the minimal object graph get_owner_ref touches, with a real dialect."""
    inspector = Inspector.__new__(Inspector)
    inspector.dialect = dialect_class()
    inspector.get_table_owner = MagicMock(return_value="alice")

    source = MagicMock()
    source.inspector = inspector
    source.source_config = DatabaseServiceMetadataPipeline(includeOwners=include_owners)
    source.get_owner_ref = DatabaseServiceSource.get_owner_ref.__get__(source)
    return source


def test_global_inspector_patch_makes_the_inspector_probe_useless():
    """Guards the premise of the tests below: every dialect looks capable."""
    for dialect_class in NON_POSTGRES_DIALECTS:
        inspector = Inspector.__new__(Inspector)
        inspector.dialect = dialect_class()
        assert hasattr(inspector, "get_table_owner")
        assert not hasattr(inspector.dialect, "get_table_owner")


@pytest.mark.parametrize("dialect_class", NON_POSTGRES_DIALECTS, ids=lambda d: d.__name__)
def test_owner_extraction_is_skipped_when_the_dialect_cannot_do_it(dialect_class, caplog):
    source = make_source(dialect_class)

    with caplog.at_level(logging.WARNING):
        assert source.get_owner_ref(table_name="customers") is None

    assert "Error processing owner" not in caplog.text
    source.inspector.get_table_owner.assert_not_called()
    source.metadata.get_reference_by_name.assert_not_called()


def test_owner_extraction_still_runs_on_a_dialect_that_implements_it():
    source = make_source(PGDialect_psycopg2)

    owner_ref = source.get_owner_ref(table_name="customers")

    source.inspector.get_table_owner.assert_called_once()
    source.metadata.get_reference_by_name.assert_called_once_with(name="alice", is_owner=True)
    assert owner_ref is source.metadata.get_reference_by_name.return_value


def test_owner_extraction_is_skipped_when_include_owners_is_off():
    source = make_source(PGDialect_psycopg2, include_owners=False)

    assert source.get_owner_ref(table_name="customers") is None
    source.inspector.get_table_owner.assert_not_called()
