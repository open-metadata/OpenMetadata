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

"""Startup and fixture contracts for the auto-loaded pytest plugin."""

import subprocess
import sys
from copy import deepcopy
from inspect import unwrap
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from _openmetadata_testutils.pytest_openmetadata import plugin


def test_plugin_registration_does_not_import_the_application() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys; import _openmetadata_testutils.pytest_openmetadata.plugin; "
            "assert 'metadata' not in sys.modules, 'Application loaded before coverage starts'",
        ],
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.fixture
def metadata_client() -> MagicMock:
    client = MagicMock()
    config = {"hostPort": "http://example.test/api", "securityConfig": {"jwtToken": "original-token"}}
    client.config.model_dump.side_effect = lambda: deepcopy(config)
    client.get_by_name.return_value = SimpleNamespace(id="bot-id")
    client.get_by_id.return_value = SimpleNamespace(config=SimpleNamespace(JWTToken="bot-token"))
    return client


def test_metadata_fixture_constructs_the_client_when_requested(
    monkeypatch: pytest.MonkeyPatch, metadata_client: MagicMock
) -> None:
    monkeypatch.setattr("_openmetadata_testutils.ometa.int_admin_ometa", lambda: metadata_client)
    assert unwrap(plugin.metadata)() is metadata_client


def test_configuration_fixtures_preserve_server_settings(metadata_client: MagicMock) -> None:
    assert unwrap(plugin.sink_config)(metadata_client) == {"type": "metadata-rest", "config": {}}
    assert unwrap(plugin.workflow_config)(metadata_client) == {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://example.test/api",
            "securityConfig": {"jwtToken": "original-token"},
        },
    }


@pytest.mark.parametrize("fixture_name", ["ingestion_bot_workflow_config", "ingestion_bot_wokflow_config"])
def test_bot_configuration_uses_the_bot_token(metadata_client: MagicMock, fixture_name: str) -> None:
    config = unwrap(plugin.workflow_config)(metadata_client)
    fixture = unwrap(getattr(plugin, fixture_name))
    result = (
        fixture(metadata_client, config) if fixture_name == "ingestion_bot_wokflow_config" else fixture(metadata_client)
    )
    assert result == {
        "loggerLevel": "DEBUG",
        "openMetadataServerConfig": {
            "hostPort": "http://example.test/api",
            "securityConfig": {"jwtToken": "bot-token"},
        },
    }


def test_cleanup_fixture_removes_only_registered_entities(metadata_client: MagicMock) -> None:
    from metadata.generated.schema.entity.teams.user import User

    entities = {"registered": SimpleNamespace(id="registered"), "unrelated": SimpleNamespace(id="unrelated")}
    metadata_client.get_by_name.side_effect = lambda entity, fqn, fields: entities.get(fqn)
    metadata_client.delete.side_effect = lambda entity_type, entity_id, recursive, hard_delete: entities.pop(entity_id)
    cleanup = unwrap(plugin.clean_up_fqn)(metadata_client)
    register = next(cleanup)
    register(User, "registered")
    register(User, "already-deleted")

    with pytest.raises(StopIteration):
        next(cleanup)

    assert set(entities) == {"unrelated"}


@pytest.mark.parametrize("raise_from_status", [False, True])
def test_workflow_fixture_executes_and_preserves_status_handling(raise_from_status: bool) -> None:
    class Workflow:
        executed = False

        @classmethod
        def create(cls, config: dict[str, str]):
            assert config == {"source": "fixture-source"}
            return cls()

        def execute(self) -> None:
            self.executed = True

        def raise_from_status(self) -> None:
            assert self.executed
            raise RuntimeError("Workflow failed")

    run = unwrap(plugin.run_workflow)()
    if raise_from_status:
        with pytest.raises(RuntimeError, match="Workflow failed"):
            run(Workflow, {"source": "fixture-source"}, raise_from_status=True)
    else:
        result = run(Workflow, {"source": "fixture-source"}, raise_from_status=False)
        assert isinstance(result, Workflow)
        assert result.executed
