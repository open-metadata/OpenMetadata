#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""MySQL-specific pytest fixtures.

Pytest auto-discovers this conftest for tests under `tests/cli_e2e_v2/mysql/`.
Session-scoped `mysql_source_ready` runs ensure_baseline once per pytest
session. Module-scoped `mysql_cfg` provides the shared default config for
tests that don't need per-test service isolation.

Filter tests that need isolated services do NOT use `mysql_cfg` — they
call `build_mysql_config(mysql_service_name(session_uuid, variant="..."),
om_server_config)` directly from the test body.

Depends on session_uuid and om_server_config fixtures from the top-level
conftest.py (Task 23). Those are referenced by name here; pytest resolves
the chain at test run time.
"""

from __future__ import annotations

import pytest

from tests.cli_e2e_v2.core.config.builder import WorkflowConfig
from tests.cli_e2e_v2.core.config.server import ServerConfig
from tests.cli_e2e_v2.core.source.orchestrator import ensure_baseline
from tests.cli_e2e_v2.mysql.baseline import MYSQL_BASELINE, get_policy
from tests.cli_e2e_v2.mysql.connector import build_mysql_config, mysql_service_name


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
