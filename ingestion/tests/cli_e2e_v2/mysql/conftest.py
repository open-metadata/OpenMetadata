#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL-specific pytest fixtures.

Pytest auto-discovers this conftest for tests under `tests/cli_e2e_v2/mysql/`.
Session-scoped `mysql_source_ready` runs ensure_baseline once per pytest
session. Module-scoped `mysql_cfg` provides the shared default config for
tests that don't need per-test service isolation. Module-scoped
`mysql_metadata_ingested` runs the metadata CLI once so profiler, lineage,
classification, structural, and description tests don't each re-ingest.

Filter tests that need isolated services do NOT use `mysql_cfg` or
`mysql_metadata_ingested` — they call `build_mysql_config(mysql_service_name(
session_uuid, variant="..."), om_server_config)` directly and run their own
ingest with the variant filter config.

Depends on session_uuid, om_server_config, and registered_services fixtures
from the top-level conftest.py. The heavy lifting lives in
`core/fixtures.py` — this module is thin per-connector wiring.
"""

from __future__ import annotations

from typing import Callable

import pytest
from sqlalchemy.engine import Engine

from ..core.config.builder import WorkflowConfig
from ..core.config.pipelines import MetadataPipeline
from ..core.config.server import ServerConfig
from ..core.expected.types import ExpectedService
from ..core.fixtures import metadata_ingest_once, run_source_baseline
from .baseline import MYSQL_BASELINE, get_admin_engine, get_policy
from .connector import build_mysql_config, mysql_service_name
from .expected import mysql_expected


@pytest.fixture(scope="session")
def mysql_service(session_uuid: str) -> str:
    """Session-shared MySQL service name (`e2e_mysql_<uuid>`).

    Eliminates `service = mysql_service_name(session_uuid)` from every
    test body. Filter tests still build their own variant-named services
    via `mysql_service_name(session_uuid, variant=...)` directly — this
    fixture is only the default, session-shared name.
    """
    return mysql_service_name(session_uuid)


@pytest.fixture(scope="module")
def mysql_expected_factory(
    mysql_service: str,
) -> Callable[..., ExpectedService]:
    """Factory for ExpectedService trees bound to the session's service name.

    Usage: `mysql_expected_factory()` returns the full expected catalog;
    `mysql_expected_factory(tables=[...])` returns a projection (used by
    filter tests to pass a pre-built expected tree into the differ).
    """

    def _factory(*, tables: list[str] | None = None) -> ExpectedService:
        return mysql_expected(mysql_service, tables=tables)

    return _factory


@pytest.fixture(scope="session")
def mysql_admin_engine() -> Engine:
    """Admin-credentials SQLAlchemy engine for tests that need to mutate
    the source out-of-band (drop a baseline table to test mark-deleted,
    create a poisoned view to test error containment, etc.).

    Shares the cached engine that `get_policy()` builds — single DSN
    source of truth.
    """
    return get_admin_engine()


@pytest.fixture(scope="session")
def mysql_source_ready() -> None:
    """Reconcile MySQL source with MYSQL_BASELINE once per pytest session.

    Fires before any MySQL test runs because `mysql_cfg` (and test-local
    variant configs) declare this as a dependency.
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
