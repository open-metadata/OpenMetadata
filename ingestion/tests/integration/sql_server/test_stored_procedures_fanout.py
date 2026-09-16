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
Regression test for #32669. MSSQL_GET_STORED_PROCEDURES joined sys.procedures to
INFORMATION_SCHEMA.ROUTINES on the bare procedure name, with no schema predicate on
sys.procedures. Two schemas holding a same-named procedure (e.g. dbo.cleanup and
sales.cleanup) fanned out one INFORMATION_SCHEMA.ROUTINES row into one row per
matching sys.procedures entry across all schemas, so the wrong definition could be
attached. The query must return exactly one row per schema, with that schema's own
definition.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_STORED_PROCEDURES

SALES_SCHEMA = "sales"


@pytest.fixture(scope="module")
def mssql_engine(mssql_container, db_name):
    url = make_url("mssql+pytds://" + mssql_container.get_connection_url().split("://")[1]).set(database=db_name)
    engine = create_engine(url, connect_args={"autocommit": True})
    with engine.connect() as conn:
        conn.execute(text("IF SCHEMA_ID('" + SALES_SCHEMA + "') IS NULL EXEC('CREATE SCHEMA " + SALES_SCHEMA + "')"))
        for schema in ("dbo", SALES_SCHEMA):
            conn.execute(text(f"IF OBJECT_ID('{schema}.cleanup') IS NOT NULL DROP PROCEDURE {schema}.cleanup"))
        conn.execute(text("CREATE PROCEDURE dbo.cleanup AS SELECT 1 AS dbo_body"))
        conn.execute(text(f"CREATE PROCEDURE {SALES_SCHEMA}.cleanup AS SELECT 2 AS sales_body"))

    yield engine

    with engine.connect() as conn:
        for schema in ("dbo", SALES_SCHEMA):
            conn.execute(text(f"IF OBJECT_ID('{schema}.cleanup') IS NOT NULL DROP PROCEDURE {schema}.cleanup"))
        conn.execute(text(f"DROP SCHEMA IF EXISTS {SALES_SCHEMA}"))
    engine.dispose()


def _cleanup_definition(engine, db_name, schema_name):
    query = MSSQL_GET_STORED_PROCEDURES.format(database_name=db_name, schema_name=schema_name)
    with engine.connect() as conn:
        rows = [row for row in conn.execute(text(query)).all() if row.name == "cleanup"]
    assert len(rows) == 1
    return rows[0].definition


def test_stored_procedure_query_does_not_fan_out_across_schemas(mssql_engine, db_name):
    dbo_definition = _cleanup_definition(mssql_engine, db_name, "dbo")
    sales_definition = _cleanup_definition(mssql_engine, db_name, SALES_SCHEMA)

    assert "dbo_body" in dbo_definition
    assert "sales_body" not in dbo_definition

    assert "sales_body" in sales_definition
    assert "dbo_body" not in sales_definition
