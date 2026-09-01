#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL-specific pytest fixtures.

Session-scoped ``mysql_container`` boots a dedicated MySQL via testcontainers,
creates the ``e2e`` schema, and provisions ``om_user`` with the OM-documented
minimum grants:

    GRANT SELECT, SHOW VIEW, EXECUTE ON e2e.* TO 'om_user'@'%';
    GRANT PROCESS, SHOW_ROUTINE ON *.* TO 'om_user'@'%';

Populates ``E2E_MYSQL_*`` env vars for the session lifetime. Depends on
``session_uuid``, ``om_server_config``, and ``registered_services`` from the
top-level conftest.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from testcontainers.mysql import MySqlContainer

from ..core.config.env import Env
from ..core.config.pipelines import MetadataPipeline
from ..core.fixture_helpers import metadata_ingest_once
from ..core.source.orchestrator import EnforcementMode, EnforcementPolicy, ensure_baseline
from .baseline import MYSQL_BASELINE
from .connector import build_mysql_config, mysql_service_name
from .enforcer import MySqlEnforcer
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
    """Boot a dedicated MySQL, create ``e2e`` schema and ``om_user``, populate ``E2E_MYSQL_*`` env vars.

    ``om_user`` GRANTs: SELECT, SHOW VIEW, EXECUTE on ``e2e.*``; PROCESS,
    SHOW_ROUTINE globally. Restores prior env var values on teardown.
    """
    container = MySqlContainer(_MYSQL_IMAGE)
    with container as running:
        host = running.get_container_host_ip()
        port = running.get_exposed_port(3306)
        # testcontainers sets MYSQL_ROOT_PASSWORD = running.password.
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

        # Populate env vars so Env(...).ref() and the admin-engine fixture resolve without testcontainers knowledge.
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


@pytest.fixture(scope="session")
def mysql_service(session_uuid: str) -> str:
    """Return the session-shared MySQL service name (``e2e_mysql_<uuid>``)."""
    return mysql_service_name(session_uuid)


@pytest.fixture(scope="module")
def mysql_expected_factory(
    mysql_service: str,
) -> Callable[..., ExpectedService]:
    """Return a factory bound to the session service name.

    ``mysql_expected_factory()`` → full catalog;
    ``mysql_expected_factory(tables=[...])`` → projection over named tables.
    """

    def _factory(*, tables: list[str] | None = None) -> ExpectedService:
        return mysql_expected(mysql_service, tables=tables)

    return _factory


@pytest.fixture(scope="session")
def mysql_admin_engine(mysql_container: MySqlContainer) -> Generator[Engine, None, None]:
    """Yield the admin (root) engine for out-of-band source mutations.

    Depends on ``mysql_container`` so E2E_MYSQL_ADMIN_* vars are set before use.
    """
    host_port = Env("E2E_MYSQL_HOST_PORT").get()
    host, _, port_str = host_port.partition(":")
    url = URL.create(
        drivername="mysql+pymysql",
        username=Env("E2E_MYSQL_ADMIN_USER", default="root").get(),
        password=Env("E2E_MYSQL_ADMIN_PASSWORD", default="password").get(),
        host=host,
        port=int(port_str) if port_str else None,
    )
    engine = create_engine(url)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture(scope="session")
def mysql_policy(mysql_admin_engine: Engine) -> EnforcementPolicy:
    """Session MySQL EnforcementPolicy backed by the admin engine."""
    enforcer = MySqlEnforcer(mysql_admin_engine, MYSQL_BASELINE)
    return EnforcementPolicy(enforcer=enforcer, mode=EnforcementMode.APPLY)


@pytest.fixture(scope="session")
def mysql_source_ready(mysql_policy: EnforcementPolicy) -> None:
    """Reconcile the MySQL source with MYSQL_BASELINE once per session."""
    ensure_baseline(mysql_policy, MYSQL_BASELINE, connector_name="mysql")


@pytest.fixture(scope="module")
def mysql_cfg(
    om_server_config: ServerConfig,
    mysql_service: str,
    mysql_source_ready: None,
) -> WorkflowConfig:
    """Return the default MySQL WorkflowConfig for the session-shared service."""
    return build_mysql_config(mysql_service, om_server_config)


@pytest.fixture(scope="module")
def mysql_metadata_ingested(
    tmp_path_factory: pytest.TempPathFactory,
    mysql_cfg: WorkflowConfig,
    mysql_service: str,
    registered_services: list[str],
) -> None:
    """Run the MySQL metadata CLI once per module against the shared service."""
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
