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
Regression tests: the ServiceSpec test-connection path must reuse the source's
already-built client instead of opening a second connection.

A second sign-in invalidates the source's live session on single-session
services (e.g. Tableau Personal Access Tokens), so every subsequent ingestion
call then fails with 401. See the BaseConnection migration regression.
"""

from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source import connections as connections_module


class FakeClient:
    def __init__(self):
        self.torn_down = False


class FakeConnection(BaseConnection):
    """Mimics a migrated connector: builds a client and runs the test against it."""

    build_count = 0

    def _get_client(self) -> FakeClient:
        type(self).build_count += 1
        client = FakeClient()
        self._on_close(lambda: setattr(client, "torn_down", True))
        return client

    def test_connection(self, metadata, automation_workflow=None, timeout_seconds=None):
        self._tested_client = self.client
        return TestConnectionResult(steps=[])


def _fake_service_connection():
    service_connection = MagicMock()
    service_connection.type.value = "Fake"
    return service_connection


def _run_with_fake_spec():
    return patch.object(
        connections_module,
        "_get_connection_class_from_spec",
        return_value=FakeConnection,
    )


class TestTestConnectionReusesClient:
    def setup_method(self):
        FakeConnection.build_count = 0

    def test_reuses_existing_client_without_second_build(self):
        existing_client = FakeClient()
        service_connection = _fake_service_connection()

        with _run_with_fake_spec():
            connections_module.test_connection_common(MagicMock(), existing_client, service_connection)

        assert FakeConnection.build_count == 0

    def test_borrowed_client_is_not_torn_down(self):
        existing_client = FakeClient()
        service_connection = _fake_service_connection()

        with _run_with_fake_spec():
            base_connection = FakeConnection(service_connection)
            base_connection.adopt_client(existing_client)
            base_connection.close()

        assert existing_client.torn_down is False

    def test_standalone_test_builds_and_tears_down_own_client(self):
        service_connection = _fake_service_connection()

        with _run_with_fake_spec():
            base_connection = FakeConnection(service_connection)
            built_client = base_connection.client
            base_connection.close()

        assert FakeConnection.build_count == 1
        assert built_client.torn_down is True
