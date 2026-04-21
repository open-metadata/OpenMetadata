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
from .core.fluent.om_client import OmClient
from .core.runner.cli_runner import CliRunner

logger = logging.getLogger(__name__)


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
    """Shared OM server URL + JWT, read from env once per session."""
    return ServerConfig.from_env()


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
def _posture_log(session_uuid: str) -> None:
    """Print session UUID at session start so developers can correlate services
    in OM UI with specific test runs."""
    print("\n==== CLI E2E v2 session start ====")
    print(f"session uuid: {session_uuid}")
    print("==================================\n")
