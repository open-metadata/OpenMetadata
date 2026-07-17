#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Lifecycle tests for BaseConnection and the connection seam. A source reuses its
BaseConnection for the test-connection step without a second sign-in; standalone
callers own teardown.
"""

import logging
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source import connections as connections_module


class FakeClient:
    def __init__(self):
        self.closed = False


class FakeConnection(BaseConnection):
    def __init__(self, service_connection):
        super().__init__(service_connection)
        self.build_count = 0
        self.last_client = None

    def _get_client(self) -> FakeClient:
        self.build_count += 1
        client = FakeClient()
        self.last_client = client
        self._on_close(lambda: setattr(client, "closed", True))
        return client

    def checks(self):
        _ = self.client
        return MagicMock()


def _service_connection():
    return SimpleNamespace(type=SimpleNamespace(value="Fake"))


def _patch_runner():
    return patch(
        "metadata.ingestion.connections.connection.TestConnectionRunner",
        return_value=MagicMock(run=MagicMock(return_value="ok")),
    )


def test_test_connection_does_not_close_or_rebuild():
    conn = FakeConnection(_service_connection())
    client = conn.client
    with _patch_runner():
        conn.test_connection(MagicMock())

    assert conn.build_count == 1
    assert conn.client is client
    assert client.closed is False


def test_context_manager_closes_client():
    conn = FakeConnection(_service_connection())
    with conn:
        client = conn.client
    assert client.closed is True
    assert conn._client is None


def test_reopen_after_close_rebuilds_and_logs(caplog):
    conn = FakeConnection(_service_connection())
    first = conn.client
    conn.close()

    with caplog.at_level(logging.INFO):
        second = conn.client

    assert conn.build_count == 2
    assert second is not first
    assert first.closed is True
    assert any("was closed; opening a new client" in r.message for r in caplog.records)


def test_first_build_does_not_log_reopen(caplog):
    conn = FakeConnection(_service_connection())
    with caplog.at_level(logging.INFO):
        _ = conn.client
    assert not any("opening a new client" in r.message for r in caplog.records)


def test_failed_build_releases_what_get_client_registered():
    """A ``_get_client`` that raises after registering a teardown still unwinds:
    the caller never receives a client, so nothing is left for it to close."""
    released = []

    class HalfBuiltConnection(BaseConnection):
        def _get_client(self):
            self._on_close(lambda: released.append("engine"))
            raise RuntimeError("client construction failed")

    conn = HalfBuiltConnection(_service_connection())
    with pytest.raises(RuntimeError):
        _ = conn.client

    assert released == ["engine"]


def test_create_connection_returns_owner():
    with patch.object(connections_module, "_get_connection_class_from_spec", return_value=FakeConnection):
        conn = connections_module.create_connection(_service_connection())
    assert isinstance(conn, FakeConnection)


def test_create_connection_none_for_non_migrated():
    with patch.object(connections_module, "_get_connection_class_from_spec", return_value=None):
        assert connections_module.create_connection(_service_connection()) is None


class OverrideConnection(FakeConnection):
    """Mirrors connectors that override test_connection without a `close` param."""

    def test_connection(self, metadata, automation_workflow=None, timeout_seconds=None):
        _ = self.client
        return "ok"


def test_run_test_connection_handles_overridden_signature_without_close():
    owner = OverrideConnection(_service_connection())
    client = owner.client
    with patch.object(connections_module, "raise_test_connection_exception"):
        connections_module.run_test_connection(MagicMock(), owner)

    assert owner.build_count == 1
    assert owner.client is client
    assert client.closed is False


def test_run_test_connection_reuses_without_rebuild_or_close():
    owner = FakeConnection(_service_connection())
    client = owner.client
    with patch.object(connections_module, "raise_test_connection_exception"), _patch_runner():
        connections_module.run_test_connection(MagicMock(), owner)

    assert owner.build_count == 1
    assert owner.client is client
    assert client.closed is False
