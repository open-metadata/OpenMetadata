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
"""Lifecycle tests for the diagnostics public API: install / shutdown / no-op."""

import threading

import pytest

from metadata.ingestion import diagnostics


class _FakeLogLevel:
    def __init__(self, value: str) -> None:
        self.value = value


class _FakeWorkflowConfig:
    def __init__(self, level: str) -> None:
        self.loggerLevel = _FakeLogLevel(level)


class _FakeWorkflow:
    def __init__(self, level: str = "DEBUG") -> None:
        self.workflow_config = _FakeWorkflowConfig(level)

    def workflow_steps(self):
        return []


@pytest.fixture(autouse=True)
def _reset_state():
    """Make sure each test starts and ends with diagnostics off."""
    diagnostics.shutdown()
    yield
    diagnostics.shutdown()


def test_operation_is_noop_when_not_installed():
    assert diagnostics.is_active() is False
    with diagnostics.operation("test.noop", entity="x"):
        pass


def test_dump_is_noop_when_not_installed():
    diagnostics.dump("not-installed")


def test_install_only_when_logger_level_is_debug():
    assert diagnostics.install(_FakeWorkflow(level="INFO")) is False
    assert diagnostics.is_active() is False

    assert diagnostics.install(_FakeWorkflow(level="DEBUG")) is True
    assert diagnostics.is_active() is True


def test_install_is_idempotent():
    assert diagnostics.install(_FakeWorkflow()) is True
    assert diagnostics.install(_FakeWorkflow()) is True
    state_first = diagnostics._get_state()
    diagnostics.install(_FakeWorkflow())
    assert diagnostics._get_state() is state_first  # same singleton, not replaced


def test_shutdown_resets_state_and_stops_threads():
    assert diagnostics.install(_FakeWorkflow()) is True
    state = diagnostics._get_state()
    assert state is not None

    diagnostics.shutdown()
    assert diagnostics.is_active() is False
    assert all(monitor.is_alive() is False or monitor._stop_event.is_set() for monitor in state._monitors)


def test_operation_records_in_registry_after_install():
    from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry

    diagnostics.install(_FakeWorkflow())
    with diagnostics.operation("test.recorded", k="v"):
        state = diagnostics._get_state()
        assert state is not None
        deepest = state.aspect(OperationRegistry).deepest_per_thread()
        assert deepest[threading.get_ident()][0] == "test.recorded"


def test_install_handles_missing_logger_level_gracefully():
    class _NoConfig:
        pass

    assert diagnostics.install(_NoConfig()) is False
