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
from the top-level conftest.py. Those are referenced by name here; pytest
resolves the chain at test run time.
"""

from __future__ import annotations

import pytest

from ..core.config.builder import WorkflowConfig
from ..core.config.server import ServerConfig
from ..core.runner.cli_runner import CliRunner
from ..core.source.orchestrator import ensure_baseline
from .baseline import MYSQL_BASELINE, get_policy
from .connector import build_mysql_config, mysql_service_name


@pytest.fixture(scope="session")
def mysql_source_ready() -> None:
    """Run ensure_baseline for MySQL once per pytest session.

    Reconciles the source DB with MYSQL_BASELINE — creates schema + tables +
    views + stored procedure, seeds deterministic rows. Fires before any
    MySQL test runs because `mysql_cfg` (and test-local variant configs)
    declare this as a dependency.
    """
    ensure_baseline(get_policy(), MYSQL_BASELINE, connector_name="mysql")


@pytest.fixture(scope="module")
def mysql_cfg(
    om_server_config: ServerConfig,
    session_uuid: str,
    mysql_source_ready: None,
) -> WorkflowConfig:
    """Default module-scoped MySQL config, using the session-shared service name.

    For tests that can share service state across the module (vanilla ingest,
    profiler — both operate on the same ingested entities). Filter tests
    should build their own variant-named config via build_mysql_config rather
    than relying on this shared fixture.
    """
    return build_mysql_config(mysql_service_name(session_uuid), om_server_config)


@pytest.fixture(scope="module")
def mysql_metadata_ingested(
    tmp_path_factory: pytest.TempPathFactory,
    mysql_cfg: WorkflowConfig,
    session_uuid: str,
    registered_services: list[str],
) -> None:
    """Run the MySQL metadata CLI once per module against the shared service.

    Cuts ~6 redundant CLI subprocess runs per pytest module pass. Tests that
    just need entities ingested (profiler, lineage, classification,
    structural, stored-procedure, descriptions) depend on this fixture
    instead of running their own metadata CLI invocation.

    Uses include_stored_procedures=True so every downstream consumer sees
    the full entity set (SPs are always present in the OM service state).
    Registers the service name for session-end cleanup so individual tests
    don't need to.
    """
    service = mysql_service_name(session_uuid)
    if service not in registered_services:
        registered_services.append(service)

    runner = CliRunner(tmp_path_factory.mktemp("mysql_ingest"))
    status = runner.run(mysql_cfg.as_metadata(include_stored_procedures=True))
    assert status.success, (
        f"module-scoped mysql metadata ingest failed: {status.all_failures}"
    )
