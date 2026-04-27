#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Top-level fixtures for the CLI E2E v2 test package.

Pytest auto-discovers this conftest for all tests under tests/cli_e2e_v2/.
Per-connector conftests (e.g., mysql/conftest.py) compose on top of these
session-level primitives.

Fixture graph:

    session_uuid ─────────────┐
                              ├─→ (consumed by per-connector service names)
    om_server_config ────┬────┘
                         │
                         ├─→ om_http_client ─┬─→ om_client (per-test)
                         │                   └─→ registered_services (cleanup)
                         │
                         └─→ _posture_log (autouse)

    tmp_path (pytest builtin) ─→ cli_runner (per-test)
"""

from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path
from typing import Iterator

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .core.config.server import ServerConfig
from .core.expected.differ import StructuralMismatch
from .core.fluent.om_client import OmClient
from .core.runner.cli_runner import CliRunner

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# pytest hooks
# -----------------------------------------------------------------------------


def pytest_assertrepr_compare(op, left, right):
    """Render `StructuralMismatch` in full when it appears in an `assert ==` /
    `assert is` comparison instead of pytest's default short repr.

    `StructuralMismatch` is normally raised, in which case pytest displays
    its `__str__` directly via the exception path. This hook covers the
    less-common but still real case where a test compares a captured
    mismatch against a sentinel (e.g. `assert run_diff() == NO_DIFFS`) —
    pytest would otherwise truncate the diff body to its short repr and
    swallow the path-grouped diagnostics we put in `__str__`.
    """
    target = left if isinstance(left, StructuralMismatch) else (
        right if isinstance(right, StructuralMismatch) else None
    )
    if target is None:
        return None
    # Each line of the rendered mismatch becomes its own report line so
    # pytest's terminal writer wraps cleanly and indentation survives.
    return [f"StructuralMismatch ({op}):"] + str(target).splitlines()


# -----------------------------------------------------------------------------
# session identity + server
# -----------------------------------------------------------------------------


@pytest.fixture(scope="session")
def session_uuid() -> str:
    """One 8-char hex UUID per pytest session.

    Used to suffix every OM service name so parallel matrix jobs never collide
    and re-runs start from a clean namespace. Short form (8 hex chars) keeps
    service names readable.
    """
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="session")
def om_server_config() -> ServerConfig:
    """Shared OM server URL + JWT, read from env once per session.

    This fixture is also the SINGLE place in the framework that installs
    the resolved JWT into `os.environ["OM_JWT_TOKEN"]`. CLI subprocesses
    inherit the parent env, and their rendered YAMLs carry
    `${OM_JWT_TOKEN}` refs that `os.path.expandvars` resolves at load
    time — so the install is necessary, but keeping it here (rather than
    in `ServerConfig.from_env()`) leaves the factory pure and makes the
    mutation explicit and named.
    """
    cfg = ServerConfig.from_env()
    # Bridge to subprocesses: the rendered cfg_*.yaml uses ${OM_JWT_TOKEN}
    # so the subprocess needs it in its env. A pre-exported OM_JWT_TOKEN
    # and a minted one both land at the same key.
    os.environ["OM_JWT_TOKEN"] = cfg.jwt_token
    return cfg


@pytest.fixture(scope="session")
def om_http_client(om_server_config: ServerConfig) -> OpenMetadata:
    """Authenticated OpenMetadata HTTP client, session-scoped.

    Built once, reused by all OmClient wrappers and by the cleanup finalizer.
    """
    conn = OpenMetadataConnection(
        hostPort=om_server_config.server_url,
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken=om_server_config.jwt_token,
        ),
    )
    return OpenMetadata(conn)


# -----------------------------------------------------------------------------
# per-test fluent + runner
# -----------------------------------------------------------------------------


@pytest.fixture
def om_client(om_http_client: OpenMetadata) -> OmClient:
    """Fluent OmClient wrapping the shared HTTP client."""
    return OmClient(om_http_client)


@pytest.fixture
def cli_runner(tmp_path: Path) -> CliRunner:
    """Per-test CliRunner bound to pytest's tmp_path.

    Each test gets its own tmp_path so cfg_*.yaml and status_*.json artifacts
    don't collide across parallel or sequential tests.
    """
    return CliRunner(tmp_path)


# -----------------------------------------------------------------------------
# session cleanup
# -----------------------------------------------------------------------------


@pytest.fixture(scope="session")
def registered_services(om_http_client: OpenMetadata) -> Iterator[list[str]]:
    """Session-scoped list of service names for end-of-session cleanup.

    Tests append names here when they create services; the finalizer deletes
    each service via the OM API (hard delete, recursive) when the pytest
    session ends. Errors during cleanup are logged but don't fail the test
    run — cleanup is best-effort.
    """
    names: list[str] = []
    yield names

    for name in names:
        try:
            svc = om_http_client.get_by_name(entity=DatabaseService, fqn=name)
            if svc is None:
                continue
            om_http_client.delete(
                entity=DatabaseService,
                entity_id=str(svc.id.root),
                hard_delete=True,
                recursive=True,
            )
            logger.info("session teardown: deleted service %s", name)
        except Exception as exc:
            logger.warning("session teardown: failed to delete %s: %s", name, exc)


# -----------------------------------------------------------------------------
# session posture log
# -----------------------------------------------------------------------------


@pytest.fixture(scope="session", autouse=True)
def _posture_log(session_uuid: str, om_server_config: ServerConfig) -> None:
    """Print session UUID + server URL + token provenance at session start.

    The three lines are the minimum needed to answer post-mortem questions
    like "did that run actually hit the server I expected?" and "was the
    failure a stale env token or a freshly minted one?" — cheap to log
    once, invaluable when triaging a flake.
    """
    print("\n==== CLI E2E v2 session start ====")
    print(f"session uuid: {session_uuid}")
    print(f"server url:   {om_server_config.server_url}")
    print(f"token source: {om_server_config.token_source}")
    print("==================================\n")
