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
"""Owned-service fixtures, ordinary pytest reporting, and contract collection."""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import nullcontext

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .contracts.validation import enforce_required_result, validate_collection
from .runtime.cli import CliRunner
from .server import ServerConfig

logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# pytest hooks
# -----------------------------------------------------------------------------


def pytest_addoption(parser):
    parser.addoption(
        "--e2e-contract-check",
        action="store_true",
        help="require complete marked contract coverage for selected connector directories",
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "e2e_contract(id): atomic connector coverage contract")


def pytest_collection_modifyitems(config, items):
    validate_collection(config, items)


@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    enforce_required_result(item, outcome.get_result())


# -----------------------------------------------------------------------------
# session identity + server
# -----------------------------------------------------------------------------


@pytest.fixture(scope="session")
def session_uuid() -> str:
    """One 8-char hex UUID per session; used to suffix service names so parallel jobs and re-runs use distinct namespaces."""
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="session")
def om_server_config(session_uuid: str, ci_output) -> ServerConfig:
    """Read OM server URL + JWT from env once per session.

    Also installs the JWT into os.environ["OM_JWT_TOKEN"] so CLI subprocesses
    can resolve ${OM_JWT_TOKEN} in their rendered YAML configs.
    """
    with ci_output():
        cfg = ServerConfig.from_env()
    os.environ["OM_JWT_TOKEN"] = cfg.jwt_token
    logger.info("CLI E2E session=%s server=%s token_source=%s", session_uuid, cfg.server_url, cfg.token_source)
    return cfg


@pytest.fixture(scope="session")
def om_http_client(om_server_config: ServerConfig) -> OpenMetadata:
    """Authenticated SDK shared by persisted observations and service cleanup."""
    conn = OpenMetadataConnection(
        hostPort=om_server_config.server_url,
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken=om_server_config.jwt_token,
        ),
    )
    return OpenMetadata(conn)


# -----------------------------------------------------------------------------
# runner + persisted observations
# -----------------------------------------------------------------------------


@pytest.fixture(scope="session")
def ci_output(request):
    """Allow CI masking commands to bypass pytest capture during credential setup."""
    if os.environ.get("GITHUB_ACTIONS") == "true":
        capture = request.config.pluginmanager.getplugin("capturemanager")
        if capture is not None:
            return capture.global_and_fixture_disabled
    return nullcontext


@pytest.fixture
def cli(tmp_path) -> CliRunner:
    return CliRunner(tmp_path / "cli")


@pytest.fixture
def om(om_http_client: OpenMetadata) -> OpenMetadata:
    """Authenticated SDK for persisted observations and owned-service cleanup."""
    return om_http_client


@pytest.fixture
def service_name(request, om, service_entity) -> str:
    """Own a unique service and remove it even when setup or the test fails."""
    name = f"e2e_{uuid.uuid4().hex}"

    def cleanup():
        # The SDK needs fields to delimit the include query parameter correctly.
        service = om.get_by_name(entity=service_entity, fqn=name, fields=["owners"], include="all")
        if service is not None:
            om.delete(
                entity=service_entity,
                entity_id=str(service.id.root),
                hard_delete=True,
                recursive=True,
            )

    request.addfinalizer(cleanup)
    return name
