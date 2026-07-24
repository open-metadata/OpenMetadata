#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Session-level fixtures for the CLI E2E v2 test package.

Fixture graph:
    session_uuid, om_server_config → om_http_client → om_client, registered_services
    tmp_path → cli_runner
    _posture_log (autouse, session)
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import TYPE_CHECKING

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

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# pytest hooks
# -----------------------------------------------------------------------------


def pytest_assertrepr_compare(op, left, right):
    """Expand StructuralMismatch in full when it appears in an assert comparison, preserving path-grouped diagnostics."""
    target = (
        left if isinstance(left, StructuralMismatch) else (right if isinstance(right, StructuralMismatch) else None)
    )
    if target is None:
        return None
    return [f"StructuralMismatch ({op}):"] + str(target).splitlines()


# -----------------------------------------------------------------------------
# session identity + server
# -----------------------------------------------------------------------------


@pytest.fixture(scope="session")
def session_uuid() -> str:
    """One 8-char hex UUID per session; used to suffix service names so parallel jobs and re-runs use distinct namespaces."""
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="session")
def om_server_config() -> ServerConfig:
    """Read OM server URL + JWT from env once per session.

    Also installs the JWT into os.environ["OM_JWT_TOKEN"] so CLI subprocesses
    can resolve ${OM_JWT_TOKEN} in their rendered YAML configs.
    """
    cfg = ServerConfig.from_env()
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
    """Print session UUID, server URL, and token source at session start."""
    print("\n==== CLI E2E v2 session start ====")
    print(f"session uuid: {session_uuid}")
    print(f"server url:   {om_server_config.server_url}")
    print(f"token source: {om_server_config.token_source}")
    print("==================================\n")
