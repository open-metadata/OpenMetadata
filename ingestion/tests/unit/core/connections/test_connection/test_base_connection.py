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
"""BaseConnection.test_connection wires the runner through checks()."""

from types import SimpleNamespace

import pytest

from metadata.core.connections.test_connection.check import check
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    Category,
)
from metadata.ingestion.connections.connection import BaseConnection


class _Step:
    def __init__(self, name, category):
        self.name = name
        self.category = category
        self.mandatory = True
        self.shortCircuit = False


class _Metadata:
    def get_by_name(self, entity, fqn):
        return SimpleNamespace(steps=[_Step("CheckAccess", Category.ConnectionGate)])


def _service_connection():
    return SimpleNamespace(type=SimpleNamespace(value="Mysql"))


class _Checks:
    errors = None

    @check(DatabaseStep.CheckAccess)
    def check_access(self):
        return None


class _MigratedConnection(BaseConnection):
    def _get_client(self):
        return None

    def get_connection_dict(self):
        return {}

    def checks(self):
        return _Checks()


class _UnmigratedConnection(BaseConnection):
    def _get_client(self):
        return None

    def get_connection_dict(self):
        return {}


def test_migrated_connection_runs_via_checks():
    connection = _MigratedConnection(_service_connection())
    result = connection.test_connection(_Metadata())
    assert result.steps[0].status.value == "Passed"
    assert result.status.value == "Successful"


def test_unmigrated_connection_raises_clearly():
    connection = _UnmigratedConnection(_service_connection())
    with pytest.raises(NotImplementedError):
        connection.test_connection(_Metadata())


def test_default_close_drops_cached_client():
    connection = _MigratedConnection(_service_connection())
    connection._client = object()
    connection.close()
    assert connection._client is None


class _RecordingConnection(_MigratedConnection):
    def __init__(self, service_connection):
        super().__init__(service_connection)
        self.closes = 0

    def close(self):
        self.closes += 1
        super().close()


def test_test_connection_closes_on_success():
    connection = _RecordingConnection(_service_connection())
    connection.test_connection(_Metadata())
    assert connection.closes == 1


class _FailingConnection(_RecordingConnection):
    def checks(self):
        raise RuntimeError("boom")


def test_test_connection_closes_even_on_error():
    connection = _FailingConnection(_service_connection())
    with pytest.raises(RuntimeError):
        connection.test_connection(_Metadata())
    assert connection.closes == 1


class _PoolClient:
    def __init__(self):
        self.disposed = False

    def dispose(self):
        self.disposed = True


class _PooledConnection(BaseConnection):
    def _get_client(self):
        client = _PoolClient()
        self._on_close(client.dispose)
        return client

    def get_connection_dict(self):
        return {}


def test_close_runs_registered_teardown_and_clears_client():
    connection = _PooledConnection(_service_connection())
    client = connection.client
    connection.close()
    assert client.disposed is True
    assert connection._client is None


def test_connection_is_reusable_after_close():
    connection = _PooledConnection(_service_connection())
    first = connection.client
    connection.close()
    second = connection.client  # lazily rebuilt
    assert second is not first
    assert first.disposed is True
    assert second.disposed is False


def test_context_manager_closes_on_exit():
    connection = _PooledConnection(_service_connection())
    with connection as ctx:
        client = ctx.client
    assert client.disposed is True


def test_registered_teardowns_run_in_lifo_order():
    order = []
    connection = _MigratedConnection(_service_connection())
    connection._on_close(lambda: order.append("first"))
    connection._on_close(lambda: order.append("second"))
    connection.close()
    assert order == ["second", "first"]
