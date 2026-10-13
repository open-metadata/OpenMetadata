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
Regression test for the apostrophe-in-identifier bug in
``MSSQL_GET_STORED_PROCEDURES``.

The query previously interpolated the database and schema names into
single-quoted T-SQL string literals via Python ``.format()``. A name holding an
apostrophe -- a legal SQL Server delimited identifier, e.g. ``[O'Brien]`` --
produced ``ROUTINE_SCHEMA = 'O'Brien'``: an unbalanced string literal that
raised a syntax error on ``conn.execute``, so stored procedures for that
schema silently vanished from the catalogue. The query now passes the names as
bound parameters, which keeps the apostrophe out of the SQL text entirely.

Against a real SQL Server this test creates an apostrophe-named schema and
procedure, then confirms the bound-parameter query returns exactly the one
expected row. Under the old ``.format()`` code the same statement would raise
before returning any rows.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_STORED_PROCEDURES

# A schema name containing an apostrophe: legal as a SQL Server delimited
# identifier (CREATE SCHEMA [O'Brien]), and the exact shape that broke the
# old single-quoted-string-literal interpolation.
APOSTROPHE_SCHEMA = "O'Brien"
PROCEDURE_NAME = "cleanup"


@pytest.fixture(scope="module")
def mssql_engine(mssql_container, db_name):
    url = make_url("mssql+pytds://" + mssql_container.get_connection_url().split("://")[1]).set(database=db_name)
    engine = create_engine(url, connect_args={"autocommit": True})
    with engine.connect() as conn:
        # Bracket-quote the apostrophe-bearing name everywhere: inside brackets
        # an apostrophe is an ordinary character, so the setup DDL is itself
        # immune to the string-literal bug being tested. Avoid OBJECT_ID('...')
        # here because its argument is a single-quoted string literal -- the very
        # construct that broke the query under test -- and use DROP PROCEDURE IF
        # EXISTS (SQL Server 2016+, available on the 2022-latest image) instead.
        conn.execute(text(f"DROP PROCEDURE IF EXISTS [{APOSTROPHE_SCHEMA}].{PROCEDURE_NAME}"))
        conn.execute(text(f"DROP SCHEMA IF EXISTS [{APOSTROPHE_SCHEMA}]"))
        conn.execute(text(f"CREATE SCHEMA [{APOSTROPHE_SCHEMA}]"))
        conn.execute(text(f"CREATE PROCEDURE [{APOSTROPHE_SCHEMA}].{PROCEDURE_NAME} AS SELECT 1 AS apostrophe_body"))

    yield engine

    with engine.connect() as conn:
        conn.execute(text(f"DROP PROCEDURE IF EXISTS [{APOSTROPHE_SCHEMA}].{PROCEDURE_NAME}"))
        conn.execute(text(f"DROP SCHEMA IF EXISTS [{APOSTROPHE_SCHEMA}]"))
    engine.dispose()


def test_stored_procedure_query_handles_apostrophe_in_schema_name(mssql_engine, db_name):
    query = text(MSSQL_GET_STORED_PROCEDURES)
    with mssql_engine.connect() as conn:
        rows = [
            row
            for row in conn.execute(
                query,
                {"database_name": db_name, "schema_name": APOSTROPHE_SCHEMA},
            ).all()
            if row.name == PROCEDURE_NAME
        ]

    assert len(rows) == 1
    assert "apostrophe_body" in rows[0].definition
