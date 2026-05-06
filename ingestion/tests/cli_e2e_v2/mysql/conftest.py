#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL-specific pytest fixtures.

Pytest auto-discovers this conftest for tests under `tests/cli_e2e_v2/mysql/`.
Session-scoped `mysql_container` boots a dedicated MySQL via testcontainers
(no shared infra dependency, no teammate-managed admin creds), bootstraps
the `e2e` target schema, and creates a scoped ingest user `om_user` with
the production-minimum permissions documented for the OpenMetadata MySQL
connector. Subsequent fixtures consume that container.

Two users live inside the container:

  - `root` (testcontainers default) — used by the framework's
    ``SqlBaselineEnforcer`` to seed and reconcile the ``e2e`` schema
    (CREATE TABLE / DROP / INSERT / SELECT). Ephemeral and disposable.
  - ``om_user`` — the scoped ingest account whose GRANTs match the minimum
    OM MySQL connector permissions:

        GRANT SELECT, SHOW VIEW, EXECUTE ON e2e.* TO 'om_user'@'%';
        GRANT PROCESS, SHOW_ROUTINE ON *.* TO 'om_user'@'%';

    Used by the CLI metadata subprocess so ingestion is exercised against
    a production-realistic privilege set, not against the framework's
    DDL-capable admin user.

The ``mysql_container`` fixture also populates the ``E2E_MYSQL_*`` environment
variables so the existing ``Env(key).ref()`` config-builder pattern keeps
rendering ``${E2E_MYSQL_*}`` placeholders into the workflow YAML — secrets
never leak to tmp_path even though they are now generated per-session.

Filter tests that need isolated services do NOT use ``mysql_cfg`` or
``mysql_metadata_ingested`` — they call ``build_mysql_config(mysql_service_name(
session_uuid, variant="..."), om_server_config)`` directly and run their own
ingest with the variant filter config.

Depends on ``session_uuid``, ``om_server_config``, and ``registered_services``
fixtures from the top-level conftest.py.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

import pytest
from sqlalchemy import create_engine, text
from testcontainers.mysql import MySqlContainer

from ..core.config.pipelines import MetadataPipeline
from ..core.fixtures import metadata_ingest_once, run_source_baseline
from .baseline import MYSQL_BASELINE, get_admin_engine, get_policy
from .connector import build_mysql_config, mysql_service_name
from .expected import mysql_expected

if TYPE_CHECKING:
    from collections.abc import Callable, Generator

    from sqlalchemy.engine import Engine

    from ..core.config.builder import WorkflowConfig
    from ..core.config.server import ServerConfig
    from ..core.expected.types import ExpectedService


_INGEST_USER = "om_user"
_INGEST_PASSWORD = "om_password"
_TARGET_SCHEMA = "e2e"
_MYSQL_IMAGE = "mysql:8.0"

_ENV_VARS = (
    "E2E_MYSQL_USER",
    "E2E_MYSQL_PASSWORD",
    "E2E_MYSQL_HOST_PORT",
    "E2E_MYSQL_ADMIN_USER",
    "E2E_MYSQL_ADMIN_PASSWORD",
    "E2E_MYSQL_DATABASE",
)


@pytest.fixture(scope="session")
def mysql_container() -> Generator[MySqlContainer, None, None]:
    """Boot a dedicated MySQL via testcontainers and bootstrap the OM-doc users.

    Creates ``e2e`` and a scoped ``om_user`` whose GRANTs match the minimum
    OM MySQL connector documentation (SELECT, SHOW VIEW, EXECUTE on the
    target schema; PROCESS globally for connection-test; SHOW_ROUTINE
    globally so stored-procedure bodies are readable). Also populates
    ``E2E_MYSQL_*`` environment variables for the rest of the session so
    the existing ``Env(key).ref()`` YAML pattern is preserved unchanged.
    """
    container = MySqlContainer(_MYSQL_IMAGE)
    with container as running:
        host = running.get_container_host_ip()
        port = running.get_exposed_port(3306)
        # MySqlContainer wires MYSQL_ROOT_PASSWORD to the same value as
        # the user password, so `running.password` IS the root password.
        root_url = f"mysql+pymysql://root:{running.password}@{host}:{port}/"
        engine = create_engine(root_url)
        try:
            with engine.begin() as conn:
                conn.execute(text(f"CREATE DATABASE IF NOT EXISTS {_TARGET_SCHEMA}"))
                conn.execute(text(f"CREATE USER IF NOT EXISTS '{_INGEST_USER}'@'%' IDENTIFIED BY '{_INGEST_PASSWORD}'"))
                conn.execute(text(f"GRANT SELECT, SHOW VIEW, EXECUTE ON {_TARGET_SCHEMA}.* TO '{_INGEST_USER}'@'%'"))
                conn.execute(text(f"GRANT PROCESS, SHOW_ROUTINE ON *.* TO '{_INGEST_USER}'@'%'"))
                conn.execute(text("FLUSH PRIVILEGES"))
        finally:
            engine.dispose()

        # Populate Env-readable vars from the running container so neither
        # connector.py (Env(...).ref()) nor baseline.py:get_admin_engine
        # (Env(...).get()) needs to know about testcontainers.
        previous: dict[str, str | None] = {var: os.environ.get(var) for var in _ENV_VARS}
        os.environ["E2E_MYSQL_USER"] = _INGEST_USER
        os.environ["E2E_MYSQL_PASSWORD"] = _INGEST_PASSWORD
        os.environ["E2E_MYSQL_HOST_PORT"] = f"{host}:{port}"
        os.environ["E2E_MYSQL_ADMIN_USER"] = "root"
        os.environ["E2E_MYSQL_ADMIN_PASSWORD"] = running.password
        os.environ["E2E_MYSQL_DATABASE"] = _TARGET_SCHEMA
        try:
            yield running
        finally:
            for var, prev in previous.items():
                if prev is None:
                    os.environ.pop(var, None)
                else:
                    os.environ[var] = prev
            # Clear the lru_cache'd engine so a second pytest run in the
            # same Python process rebuilds against a freshly booted
            # container instead of reusing a stale URL.
            get_admin_engine.cache_clear()
            get_policy.cache_clear()


@pytest.fixture(scope="session")
def mysql_service(session_uuid: str) -> str:
    """Session-shared MySQL service name (``e2e_mysql_<uuid>``).

    Eliminates ``service = mysql_service_name(session_uuid)`` from every
    test body. Filter tests still build their own variant-named services
    via ``mysql_service_name(session_uuid, variant=...)`` directly — this
    fixture is only the default, session-shared name.
    """
    return mysql_service_name(session_uuid)


@pytest.fixture(scope="module")
def mysql_expected_factory(
    mysql_service: str,
) -> Callable[..., ExpectedService]:
    """Factory for ExpectedService trees bound to the session's service name.

    Usage: ``mysql_expected_factory()`` returns the full expected catalog;
    ``mysql_expected_factory(tables=[...])`` returns a projection (used by
    filter tests to pass a pre-built expected tree into the differ).
    """

    def _factory(*, tables: list[str] | None = None) -> ExpectedService:
        return mysql_expected(mysql_service, tables=tables)

    return _factory


@pytest.fixture(scope="session")
def mysql_admin_engine(mysql_container: MySqlContainer) -> Engine:
    """Admin-credentials SQLAlchemy engine for tests that need to mutate
    the source out-of-band (drop a baseline table to test mark-deleted,
    create a poisoned view to test error containment, etc.).

    Shares the cached engine that ``get_policy()`` builds — single DSN
    source of truth — and depends on ``mysql_container`` so the env vars
    feeding ``get_admin_engine`` are populated before first use.
    """
    return get_admin_engine()


@pytest.fixture(scope="session")
def mysql_source_ready(mysql_container: MySqlContainer) -> None:
    """Reconcile MySQL source with MYSQL_BASELINE once per pytest session.

    Fires before any MySQL test runs because ``mysql_cfg`` (and test-local
    variant configs) declare this as a dependency. Depends on
    ``mysql_container`` so admin creds + schema exist before the enforcer
    runs CREATE TABLE.
    """
    run_source_baseline(get_policy, MYSQL_BASELINE, connector_name="mysql")


@pytest.fixture(scope="module")
def mysql_cfg(
    om_server_config: ServerConfig,
    mysql_service: str,
    mysql_source_ready: None,
) -> WorkflowConfig:
    """Default module-scoped MySQL config, using the session-shared service name.

    For tests that can share service state across the module (vanilla ingest,
    profiler — both operate on the same ingested entities). Filter tests
    should build their own variant-named config via build_mysql_config rather
    than relying on this shared fixture.
    """
    return build_mysql_config(mysql_service, om_server_config)


@pytest.fixture(scope="module")
def mysql_metadata_ingested(
    tmp_path_factory: pytest.TempPathFactory,
    mysql_cfg: WorkflowConfig,
    mysql_service: str,
    registered_services: list[str],
) -> None:
    """Run the MySQL metadata CLI once per module against the shared service.

    Cuts ~6 redundant CLI subprocess runs per module pass. Tests that just
    need entities ingested (profiler, lineage, classification, structural,
    stored-procedure, descriptions) depend on this fixture instead of
    invoking their own metadata ingest.
    """
    metadata_ingest_once(
        tmp_path_factory,
        mysql_cfg,
        registered_services,
        service_name=mysql_service,
        pipeline_options=MetadataPipeline(
            includeStoredProcedures=True,
            includeDDL=True,  # parses view definitions for view->table lineage
        ),
        filter_kwargs={"schemas_include": ["e2e"]},
        label="mysql",
    )
