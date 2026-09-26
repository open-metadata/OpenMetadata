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
SQL Server must not report OpenMetadata's own queries back as user queries.

These assertions can only be made against a real server: the header is dropped or
kept depending on how SQL Server splits a batch into statements, which no amount
of string inspection reveals.
"""

import pytest
from sqlalchemy import create_engine, text

from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection as MssqlConnectionConfig,
)
from metadata.ingestion.source.database.azuresql.connection import (
    AzureSQLConnection as AzureSQLBaseConnection,
)
from metadata.ingestion.source.database.mssql.connection import (
    MssqlConnection as MssqlBaseConnection,
)
from metadata.ingestion.source.database.mssql.queries import (
    MSSQL_SQL_STATEMENT,
    MSSQL_SQL_STATEMENT_FROM_QUERY_STORE,
)

OM_MARKER = "OpenMetadata"
# lives in the statement body, so it survives whether or not the header does
PROBE_MARKER = "header" + "_probe"

# every shape OM issues: bare, leading-newline (textwrap.dedent), CTE, parameterised.
# Each one reads a real table on purpose: a constant-only SELECT compiles without a
# plan Query Store keeps, so it is never recorded and the assertions below would pass
# without proving anything.
PROBE_TABLE = "SalesLT.Customer"
PROBE_COLUMN = "CustomerID"
STATEMENTS = [
    f"SELECT {PROBE_COLUMN} AS header_probe_plain FROM {PROBE_TABLE}",
    f"\nSELECT {PROBE_COLUMN} AS header_probe_nl FROM {PROBE_TABLE}",
    f"\n SELECT {PROBE_COLUMN} AS header_probe_nlsp FROM {PROBE_TABLE}",
    f"WITH probe AS (SELECT {PROBE_COLUMN} AS c FROM {PROBE_TABLE}) SELECT c AS header_probe_cte FROM probe",
]
# every alias above, plus the parameterised probe: each must reach Query Store or the
# shape is untested
PROBE_ALIASES = (
    "header_probe_plain",
    "header_probe_nl",
    "header_probe_nlsp",
    "header_probe_cte",
    "header_probe_param",
)


@pytest.fixture(scope="module")
def query_store_db(mssql_container, db_name):
    """Enable Query Store with full capture so every probe statement is recorded."""
    engine = create_engine(
        "mssql+pytds://" + mssql_container.get_connection_url().split("://")[1],
        connect_args={"autocommit": True},
    )
    with engine.connect() as conn:
        conn.execute(text(f"ALTER DATABASE [{db_name}] SET QUERY_STORE = ON"))
        conn.execute(text(f"ALTER DATABASE [{db_name}] SET QUERY_STORE (QUERY_CAPTURE_MODE = ALL)"))
    yield db_name
    with engine.connect() as conn:
        conn.execute(text(f"ALTER DATABASE [{db_name}] SET QUERY_STORE = OFF"))


def om_engine(connection_config, base_connection_cls):
    return base_connection_cls(connection_config).client


def run_probe_statements(engine):
    with engine.connect() as conn:
        for statement in STATEMENTS:
            conn.execute(text(statement))
        # parameterised: SQL Server records these via sp_executesql, which puts the
        # parameter declarations ahead of the statement
        conn.execute(
            text(f"SELECT :v AS header_probe_param, {PROBE_COLUMN} FROM {PROBE_TABLE}"),
            {"v": 5},
        )


def recorded_texts(mssql_container, db_name, query):
    """Rows the usage query would hand to the parser, after its own filtering."""
    engine = create_engine(
        f"mssql+pytds://{mssql_container.get_connection_url().split('://')[1]}",
        connect_args={"autocommit": True},
    )
    sql = query.format(
        result_limit=1000,
        start_time="2000-01-01 00:00:00",
        end_time="2100-01-01 00:00:00",
        start_date="2000-01-01 00:00:00",
        filters="",
    ).replace("%%", "%")
    with engine.connect() as conn:
        conn.execute(text(f"USE [{db_name}]"))
        conn.execute(text("EXEC sys.sp_query_store_flush_db"))
        return [row.query_text for row in conn.execute(text(sql)).fetchall()]


@pytest.fixture(scope="module")
def mssql_om_engine(mssql_container, query_store_db, scheme):
    config = MssqlConnectionConfig(
        username=mssql_container.username,
        password=mssql_container.password,
        hostPort="localhost:" + mssql_container.get_exposed_port(mssql_container.port),
        database=query_store_db,
        scheme=scheme,
        connectionOptions={"TrustServerCertificate": "yes", "MARS_Connection": "yes"},
    )
    return om_engine(config, MssqlBaseConnection)


@pytest.fixture(scope="module")
def azuresql_om_engine(mssql_container, query_store_db):
    """Azure SQL speaks the same protocol, so the container stands in for it here."""
    config = AzureSQLConnection(
        username=mssql_container.username,
        password=mssql_container.password,
        hostPort="localhost:" + mssql_container.get_exposed_port(mssql_container.port),
        database=query_store_db,
        connectionOptions={"TrustServerCertificate": "yes", "MARS_Connection": "yes"},
    )
    return om_engine(config, AzureSQLBaseConnection)


class TestOpenMetadataQueriesAreFiltered:
    @pytest.mark.parametrize(
        "query",
        [MSSQL_SQL_STATEMENT_FROM_QUERY_STORE, MSSQL_SQL_STATEMENT],
        ids=["query_store", "plan_cache"],
    )
    def test_mssql_own_queries_do_not_reach_the_parser(self, mssql_om_engine, mssql_container, query_store_db, query):
        run_probe_statements(mssql_om_engine)

        leaked = [text_ for text_ in recorded_texts(mssql_container, query_store_db, query) if PROBE_MARKER in text_]

        assert leaked == []

    @pytest.mark.parametrize(
        "query",
        [MSSQL_SQL_STATEMENT_FROM_QUERY_STORE, MSSQL_SQL_STATEMENT],
        ids=["query_store", "plan_cache"],
    )
    def test_azuresql_own_queries_do_not_reach_the_parser(
        self, azuresql_om_engine, mssql_container, query_store_db, query
    ):
        run_probe_statements(azuresql_om_engine)

        leaked = [text_ for text_ in recorded_texts(mssql_container, query_store_db, query) if PROBE_MARKER in text_]

        assert leaked == []


class TestHeaderSurvivesIntoQueryStore:
    """A filter can only work if SQL Server kept the header in the first place."""

    def test_query_store_keeps_the_header_for_every_statement_shape(
        self, mssql_om_engine, mssql_container, query_store_db
    ):
        run_probe_statements(mssql_om_engine)

        engine = create_engine(
            f"mssql+pytds://{mssql_container.get_connection_url().split('://')[1]}",
            connect_args={"autocommit": True},
        )
        with engine.connect() as conn:
            conn.execute(text(f"USE [{query_store_db}]"))
            conn.execute(text("EXEC sys.sp_query_store_flush_db"))
            rows = conn.execute(
                # the marker is split so this query's own text cannot match it and
                # pollute the store for later tests
                text(
                    "SELECT query_sql_text FROM sys.query_store_query_text"
                    " WHERE query_sql_text LIKE '%hea' + 'der_probe%'"
                )
            ).fetchall()

        probes = [row[0] for row in rows if "query_store_query_text" not in row[0]]

        assert probes, "no probe statements were recorded"
        recorded = " ".join(probes)
        for alias in PROBE_ALIASES:
            assert alias in recorded, f"{alias} never reached Query Store, so its shape is untested"
        assert all(OM_MARKER in probe for probe in probes)
        assert not any(probe.lstrip().startswith("/*") for probe in probes)
