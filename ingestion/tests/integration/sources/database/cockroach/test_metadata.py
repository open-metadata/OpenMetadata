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
Integration test verifying that CockroachDB materialized views (relkind 'm')
are returned by COCKROACH_GET_VIEW_NAMES after the relkind filter was widened
from IN ('v') to IN ('v', 'm').

Spins up a real CockroachDB container via testcontainers, creates a base table,
a plain view, and a materialized view, then runs the actual queries that
``CockroachSource.query_table_names_and_types`` and
``CockroachSource.query_view_names_and_types`` execute against the live DB
and asserts the resulting ``TableType`` mapping is correct.

This test does NOT require an OpenMetadata server: it exercises the SQL fix
directly against the emulated PostgreSQL catalog, which is the only layer
modified by the bug fix.
"""

import pytest
from sqlalchemy import create_engine, text
from testcontainers.cockroachdb import CockroachDBContainer
from testcontainers.core.waiting_utils import wait_for_logs

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_pg_mappings import RELKIND_MAP

SCHEMA = "matview_test"


@pytest.fixture(scope="module")
def crdb_engine():
    container = CockroachDBContainer(image="cockroachdb/cockroach:v23.1.0")
    with container as container:
        # Testcontainers returns after user creation, before database privileges are granted.
        wait_for_logs(container, "end running init files from /docker-entrypoint-initdb.d")
        engine = create_engine(container.get_connection_url())
        with engine.begin() as conn:
            conn.execute(text(f"CREATE SCHEMA {SCHEMA}"))
            conn.execute(text(f"CREATE TABLE {SCHEMA}.base_table (id INT, amount DECIMAL)"))
            conn.execute(text(f"INSERT INTO {SCHEMA}.base_table VALUES (1, 100), (2, 200)"))
            conn.execute(text(f"CREATE VIEW {SCHEMA}.plain_view AS SELECT id FROM {SCHEMA}.base_table"))
            conn.execute(
                text(
                    f"CREATE MATERIALIZED VIEW {SCHEMA}.mat_view AS "
                    f"SELECT id, SUM(amount) AS total FROM {SCHEMA}.base_table GROUP BY id"
                )
            )
        yield engine
        engine.dispose()


def test_cockroach_reports_matview_with_relkind_m(crdb_engine):
    """CockroachDB must report a materialized view with relkind 'm' in
    pg_class — the value the bug-excluded filter never matched."""
    with crdb_engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT c.relname, c.relkind "
                "FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                f"WHERE n.nspname = '{SCHEMA}' "
                "ORDER BY c.relname"
            )
        ).all()
    kinds = {row[0]: row[1] for row in rows}
    assert kinds["base_table"] == "r"
    assert kinds["plain_view"] == "v"
    assert kinds["mat_view"] == "m", f"expected 'm' for matview; got {kinds.get('mat_view')!r}"


def test_fixed_view_query_returns_matview(crdb_engine):
    """The fixed COCKROACH_GET_VIEW_NAMES must return both the plain view
    and the materialized view, and the relkind mapping must type the matview
    as MaterializedView."""
    from metadata.ingestion.source.database.cockroach.queries import (
        COCKROACH_GET_TABLE_NAMES,
        COCKROACH_GET_VIEW_NAMES,
    )

    with crdb_engine.connect() as conn:
        view_rows = conn.execute(text(COCKROACH_GET_VIEW_NAMES), {"schema": SCHEMA}).all()
        table_rows = conn.execute(text(COCKROACH_GET_TABLE_NAMES), {"schema": SCHEMA}).all()

    view_names = {row[0]: RELKIND_MAP.get(row[1], TableType.Regular) for row in view_rows}
    table_names = {row[0]: RELKIND_MAP.get(row[1], TableType.Regular) for row in table_rows}

    assert "mat_view" in view_names, f"matview not returned by view query; got {sorted(view_names)}"
    assert view_names["mat_view"] == TableType.MaterializedView
    assert view_names["plain_view"] == TableType.View

    assert "base_table" in table_names, f"base_table not returned by table query; got {sorted(table_names)}"
    assert table_names["base_table"] == TableType.Regular
    assert "mat_view" not in table_names, "matview leaked into table query (would bypass includeViews gate)"


def test_matview_columns_are_populated(crdb_engine):
    """The matview's columns must be queryable so a downstream ingestion could
    populate them — i.e. the matview is a real, queryable CockroachDB object
    rather than a catalog-only stub."""
    with crdb_engine.connect() as conn:
        cols = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                f"WHERE table_schema = '{SCHEMA}' AND table_name = 'mat_view' "
                "ORDER BY ordinal_position"
            )
        ).all()
    column_names = [row[0] for row in cols]
    # CockroachDB implicitly adds a hidden `rowid` column to tables/views/matviews
    # that don't declare a primary key. Assert the user-visible columns exist
    # rather than an exact equality that would be sensitive to impl details.
    assert "id" in column_names and "total" in column_names
