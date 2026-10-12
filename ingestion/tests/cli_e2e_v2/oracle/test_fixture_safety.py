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
"""Live Oracle isolation, grants, owned cleanup and source-bound workflow gates.

``DROP USER ... CASCADE`` is the most destructive statement in this suite and is
built by interpolating a generated identifier. These tests pin that it removes
exactly the schema it owns and nothing beside it, and that the ingestion account
stays read-only.
"""

import os

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import DatabaseError

from ..features.database.pipelines import MetadataPipeline
from .connector import oracle_invocation
from .source import fresh_oracle_source


def _rows(engine, sql, **parameters):
    with engine.connect() as connection:
        return connection.execute(text(sql), parameters).all()


def _assert_removed(engine, schema):
    """The Oracle user, its objects and its grants are all gone."""
    assert _rows(engine, "SELECT username FROM dba_users WHERE username = upper(:name)", name=schema) == []
    assert _rows(engine, "SELECT object_name FROM dba_objects WHERE owner = upper(:name)", name=schema) == []
    assert _rows(engine, "SELECT grantee FROM dba_tab_privs WHERE owner = upper(:name)", name=schema) == []


def test_sources_isolate_mutations_and_cleanup(oracle_admin_engine, oracle_ingestion_engine):
    """A source mutates and drops only its own schema; a sibling is untouched by its teardown."""
    with fresh_oracle_source(oracle_admin_engine) as source_a:
        source_a.set_value("customers", 1, "credit_score", 999)
        source_a.drop_table("all_types")
        assert _rows(oracle_admin_engine, f"SELECT credit_score FROM {source_a.schema}.customers WHERE id=1") == [
            (999,)
        ]
        assert not inspect(oracle_admin_engine).has_table("all_types", schema=source_a.schema)

        with fresh_oracle_source(oracle_admin_engine) as source_b:
            assert source_a.schema != source_b.schema
            # Cross-schema names are not addressable through the owned-source API.
            with pytest.raises(KeyError):
                source_a.drop_table(f"{source_b.schema}.all_types")
            with pytest.raises(KeyError):
                source_a.set_value(f"{source_b.schema}.customers", 1, "credit_score", 1)
            with pytest.raises(ValueError, match="Expected one"):
                source_a.set_value("customers", 999, "credit_score", 1)
            # The sibling kept its seeded values while source_a was being mutated.
            assert _rows(
                oracle_ingestion_engine, f"SELECT credit_score FROM {source_b.schema}.customers WHERE id=1"
            ) == [(720,)]
            assert _rows(oracle_ingestion_engine, f"SELECT COUNT(*) FROM {source_b.schema}.all_types") == [(3,)]
            schema_b = source_b.schema
        _assert_removed(oracle_admin_engine, schema_b)
        # Dropping the sibling left this source intact.
        assert _rows(oracle_admin_engine, f"SELECT COUNT(*) FROM {source_a.schema}.customers") == [(5,)]
        schema_a = source_a.schema
    _assert_removed(oracle_admin_engine, schema_a)


def test_ingestion_account_reads_owned_schemas_but_cannot_write(oracle_source, oracle_ingestion_engine):
    """The ingestion account can read the seeded data and the dictionary, but not modify anything."""
    assert _rows(oracle_ingestion_engine, f"SELECT COUNT(*) FROM {oracle_source.schema}.customers") == [(5,)]
    with pytest.raises(DatabaseError):
        _rows(oracle_ingestion_engine, f"UPDATE {oracle_source.schema}.customers SET credit_score=1 WHERE id=1")
    with pytest.raises(DatabaseError):
        _rows(oracle_ingestion_engine, f"DROP TABLE {oracle_source.schema}.customers")
    # SELECT_CATALOG_ROLE is what lets the connector read the DBA_ views it defaults to.
    sources = _rows(
        oracle_ingestion_engine,
        "SELECT text FROM dba_source WHERE owner = upper(:schema) AND name = 'SP_ACTIVE_CUSTOMER_COUNT'",
        schema=oracle_source.schema,
    )
    assert sources
    assert all(body for (body,) in sources)


def test_invocations_reject_unowned_environments_and_closed_sources(
    oracle_source, oracle_admin_engine, om_server_config, monkeypatch
):
    """A workflow cannot be built against an environment that is not this fixture's instance."""

    def build(sources):
        return oracle_invocation(
            service_name="unused",
            sources=sources,
            options=MetadataPipeline(),
            filters={},
            server=om_server_config,
        )

    build((oracle_source,))

    monkeypatch.setitem(os.environ, "E2E_ORACLE_HOST_PORT", "somewhere-else:1521")
    with pytest.raises(ValueError, match="does not identify the sources"):
        build((oracle_source,))
    monkeypatch.undo()

    monkeypatch.setitem(os.environ, "E2E_ORACLE_USER", "someone_else")
    with pytest.raises(ValueError, match="does not identify the sources"):
        build((oracle_source,))
    monkeypatch.undo()

    with pytest.raises(ValueError, match="nonempty tuple"):
        build(())

    with fresh_oracle_source(oracle_admin_engine) as other:
        pass
    with pytest.raises(ValueError, match="already been closed"):
        build((other,))


def test_seed_failure_removes_schema_and_grants(oracle_admin_engine, monkeypatch):
    """A failure partway through setup leaves no user behind.

    The failure is raised inside ``fresh_oracle_source.__enter__``, so the context
    body never runs and the schema name is never handed out. Comparing the owned-user
    set before and after is therefore the only way to see what setup left behind —
    and it is also the stronger assertion, since it would catch a leaked user under
    any name, not just the one this call generated.
    """

    def owned_users() -> set[str]:
        return {row[0] for row in _rows(oracle_admin_engine, "SELECT username FROM dba_users")}

    before = owned_users()
    real = text

    def explode(statement):
        if "CREATE VIEW" in str(statement):
            raise RuntimeError("seed boom")
        return real(statement)

    monkeypatch.setattr("ingestion.tests.cli_e2e_v2.oracle.source.text", explode)
    with pytest.raises(RuntimeError, match="seed boom"), fresh_oracle_source(oracle_admin_engine):
        pass
    monkeypatch.undo()

    leaked = owned_users() - before
    assert not leaked, f"partial setup left Oracle users behind: {sorted(leaked)}"


def test_credentials_are_not_exposed_in_representations(oracle_instance, oracle_source):
    """Neither the instance nor the source repr carries a password or an engine URL."""
    secrets = (os.environ["E2E_ORACLE_PASSWORD"],)
    for rendered in (repr(oracle_instance), repr(oracle_source)):
        for secret in secrets:
            assert secret not in rendered
        assert "oracle+oracledb://" not in rendered
