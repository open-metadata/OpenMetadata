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
from collections import Counter
from contextlib import nullcontext
from pathlib import Path

import pytest

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .contracts.inventory import inventory_for
from .features.database.catalog.differ import StructuralMismatch
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
    if not config.getoption("e2e_contract_check"):
        return
    configured_ignores = [
        option.split("=", 1)[1] for option in config.getini("addopts") if option.startswith("--ignore=")
    ]
    additional_ignores = Counter(config.getoption("ignore") or ()) - Counter(configured_ignores)
    if (
        any(config.getoption(option) for option in ("keyword", "markexpr", "deselect", "ignore_glob"))
        or config.getoption("lf", default=False)
        or additional_ignores
    ):
        raise pytest.UsageError(
            "--e2e-contract-check requires complete connector directories without selection options"
        )

    errors = []
    for target in _contract_targets(config):
        try:
            inventory = inventory_for(target)
        except (TypeError, ValueError) as error:
            errors.append(str(error))
            continue
        errors.extend(_inventory_errors(target.name, inventory))
        errors.extend(_collection_errors(target, inventory, items))
    if errors:
        raise pytest.UsageError("E2E contract inventory incomplete:\n" + "\n".join(errors))


def _contract_targets(config):
    targets = []
    for argument in config.args:
        path = Path(argument)
        if "::" in argument or not path.is_dir() or path.parent.name != "cli_e2e_v2":
            raise pytest.UsageError("--e2e-contract-check requires complete connector directories")
        if path.name in {"meta", "core", "contracts", "features", "runtime"}:
            raise pytest.UsageError("--e2e-contract-check requires connector directories, not framework directories")
        targets.append(path.resolve())
    if not targets:
        raise pytest.UsageError("--e2e-contract-check requires complete connector directories")
    return targets


def _inventory_errors(family, inventory):
    errors = []
    if inventory.family != family:
        errors.append(f"{family}: inventory family mismatch ({inventory.family})")
    if not inventory.required:
        errors.append(f"{family}: inventory must declare required contract IDs")
    errors.extend(
        f"{family}: unsupported unknown contract ID {contract_id}"
        for contract_id in sorted(set(inventory.unsupported) - inventory.required)
    )
    for contract_id, reason in sorted(inventory.unsupported.items()):
        if not reason.strip():
            errors.append(f"{family}: unsupported {contract_id} requires a reason")
        if inventory.capabilities.get(contract_id.split(".", 1)[0]) is True:
            errors.append(f"{family}: {contract_id} cannot be unsupported; generated connection declares support")
    return errors


def _collection_errors(target, inventory, items):
    family = target.name
    errors = []
    collected = []
    for item in items:
        if not item.path.is_relative_to(target):
            continue
        for marker in item.iter_markers("e2e_contract"):
            if len(marker.args) != 1 or not isinstance(marker.args[0], str) or not marker.args[0]:
                errors.append(f"{family}: {item.nodeid} has invalid e2e_contract marker")
                continue
            contract_id = marker.args[0]
            if contract_id not in inventory.required:
                errors.append(f"{family}: unknown contract ID {contract_id} on {item.nodeid}")
            elif contract_id in inventory.unsupported:
                errors.append(f"{family}: unsupported contract {contract_id} has a collected case")
            elif any(item.get_closest_marker(mark) for mark in ("skip", "skipif", "xfail")):
                errors.append(f"{family}: {contract_id} is skipped or xfailed on {item.nodeid}")
            else:
                collected.append(contract_id)
    for contract_id, count in sorted(Counter(collected).items()):
        if count > 1:
            errors.append(f"{family}: duplicate case ID {contract_id} ({count} collected items)")
    errors.extend(
        f"{family}: {contract_id} missing collected case"
        for contract_id in sorted(inventory.required - set(collected) - set(inventory.unsupported))
    )
    return errors


@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if not item.config.getoption("e2e_contract_check"):
        return
    if not (report.skipped or (report.passed and hasattr(report, "wasxfail"))):
        return
    contracts = ", ".join(marker.args[0] for marker in item.iter_markers("e2e_contract"))
    if contracts:
        reason = getattr(report, "wasxfail", None) or str(report.longrepr)
        report.outcome = "failed"
        report.longrepr = (
            f"Required E2E contract {contracts} did not complete {report.when}: "
            f"skips and xfails are not coverage.\n{reason}"
        )
        if hasattr(report, "wasxfail"):
            del report.wasxfail


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
        service = om.get_by_name(entity=service_entity, fqn=name)
        if service is not None:
            om.delete(
                entity=service_entity,
                entity_id=str(service.id.root),
                hard_delete=True,
                recursive=True,
            )

    request.addfinalizer(cleanup)
    return name
