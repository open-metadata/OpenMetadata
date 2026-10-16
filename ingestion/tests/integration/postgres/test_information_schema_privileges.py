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
Regression tests for #23870. The Postgres connector must not depend on
information_schema, whose views are privilege-filtered so a role only sees the
objects it owns or holds a privilege on. Partition details and RLS-policy tags
must resolve even for a least-privilege role that has no privileges on the tables.
"""

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine.url import make_url

from metadata.ingestion.source.database.postgres.queries import (
    POSTGRES_GET_ALL_TABLE_PG_POLICY,
    POSTGRES_PARTITION_DETAILS,
    POSTGRES_TEST_GET_TAGS,
)

LOW_PRIV_ROLE = "om_lowpriv_23870"
LOW_PRIV_PASSWORD = "lowpriv"
SCHEMA = "priv_test_23870"


@pytest.fixture(scope="module")
def lowpriv_engine(postgres_container):
    """
    Seed a partitioned table and an RLS-policy table, plus a role that has USAGE on
    the schema but no privileges on the tables, then hand back an engine bound to
    that role. This mirrors a least-privilege OpenMetadata deployment.
    """
    admin_engine = create_engine(postgres_container.get_connection_url())
    with admin_engine.connect() as conn:
        # Drop the schema (and its grants) before the role so a leftover from a
        # crashed prior run does not make DROP ROLE fail on a dependent privilege.
        conn.execute(text(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE"))
        conn.execute(text(f"DROP ROLE IF EXISTS {LOW_PRIV_ROLE}"))
        conn.execute(text(f"CREATE ROLE {LOW_PRIV_ROLE} LOGIN PASSWORD '{LOW_PRIV_PASSWORD}'"))
        conn.execute(text(f"CREATE SCHEMA {SCHEMA}"))
        conn.execute(text(f"GRANT USAGE ON SCHEMA {SCHEMA} TO {LOW_PRIV_ROLE}"))
        conn.execute(
            text(
                f"CREATE TABLE {SCHEMA}.events "
                "(id bigint NOT NULL, event_day date NOT NULL, payload text) "
                "PARTITION BY RANGE (event_day)"
            )
        )
        conn.execute(
            text(
                f"CREATE TABLE {SCHEMA}.events_2026 PARTITION OF {SCHEMA}.events "
                "FOR VALUES FROM ('2026-01-01') TO ('2027-01-01')"
            )
        )
        conn.execute(text(f"CREATE TABLE {SCHEMA}.secured (id bigint, owner_name text)"))
        conn.execute(text(f"ALTER TABLE {SCHEMA}.secured ENABLE ROW LEVEL SECURITY"))
        conn.execute(text(f"CREATE POLICY secured_owner_policy ON {SCHEMA}.secured USING (owner_name = current_user)"))
        conn.commit()

    url = make_url(postgres_container.get_connection_url()).set(username=LOW_PRIV_ROLE, password=LOW_PRIV_PASSWORD)
    engine = create_engine(url)
    yield engine
    engine.dispose()

    with admin_engine.connect() as conn:
        conn.execute(text(f"DROP TABLE IF EXISTS {SCHEMA}.events CASCADE"))
        conn.execute(text(f"DROP TABLE IF EXISTS {SCHEMA}.secured CASCADE"))
        conn.execute(text(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE"))
        conn.execute(text(f"DROP ROLE IF EXISTS {LOW_PRIV_ROLE}"))
        conn.commit()
    admin_engine.dispose()


def test_partition_details_resolve_for_least_privilege_role(lowpriv_engine):
    """POSTGRES_PARTITION_DETAILS must return the partition column even without table privileges."""
    with lowpriv_engine.connect() as conn:
        rows = conn.execute(
            text(POSTGRES_PARTITION_DETAILS),
            {"table_name": "events", "schema_name": SCHEMA},
        ).all()

    column_names = [row.column_name for row in rows if row.column_name]
    assert column_names == ["event_day"]


def test_pg_policy_tags_resolve_for_least_privilege_role(lowpriv_engine, postgres_container):
    """POSTGRES_GET_ALL_TABLE_PG_POLICY must return the RLS policy even without table privileges."""
    database = make_url(postgres_container.get_connection_url()).database
    with lowpriv_engine.connect() as conn:
        rows = conn.execute(
            text(POSTGRES_GET_ALL_TABLE_PG_POLICY),
            {"schema_name": SCHEMA, "database_name": database},
        ).all()

    # yield_tag reads row[1] as the policy name and row[2:] as FQN elements
    policy_names = [row[1] for row in rows]
    assert "secured_owner_policy" in policy_names
    # every returned row must belong to the requested schema (no cross-schema contamination)
    for row in rows:
        assert row[3] == SCHEMA


def test_get_tags_probe_runs_for_least_privilege_role(lowpriv_engine):
    """POSTGRES_TEST_GET_TAGS (test-connection step) must see the policy for a low-priv role."""
    with lowpriv_engine.connect() as conn:
        rows = conn.execute(text(POSTGRES_TEST_GET_TAGS)).all()

    assert len(rows) >= 1
