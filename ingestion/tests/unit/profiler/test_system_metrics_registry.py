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
"""Unit tests for the system metrics implementation registry."""

import logging
from types import SimpleNamespace

import pytest

from metadata.profiler.metrics.system import system as system_module
from metadata.profiler.metrics.system.system import SystemMetricsRegistry
from metadata.utils.importer import DynamicImportException


@pytest.fixture(autouse=True)
def clean_registry():
    """Isolate the process-wide registry between tests."""
    original = dict(SystemMetricsRegistry._registry)
    SystemMetricsRegistry._registry.clear()
    yield
    SystemMetricsRegistry._registry.clear()
    SystemMetricsRegistry._registry.update(original)


def test_dialect_without_implementation_is_discovered_once(monkeypatch, caplog):
    """A missing implementation is looked up once per dialect, not once per table.

    `SQAProfilerInterface` builds one interface per table, so an uncached miss re-runs
    the failing import and re-logs it for every table profiled.
    """
    imported = []

    def failing_import(key: str, *_args, **_kwargs):
        imported.append(key)
        raise DynamicImportException(module=key, cause=ModuleNotFoundError(key))

    monkeypatch.setattr(system_module, "import_from_module", failing_import)
    dialect = SimpleNamespace(name="vertica")

    with caplog.at_level(logging.DEBUG, logger=system_module.logger.name):
        assert SystemMetricsRegistry.get(dialect) is None
        assert SystemMetricsRegistry.get(dialect) is None

    assert imported == ["metadata.profiler.metrics.system.vertica.system"]
    messages = [record for record in caplog.records if "No implementation found for vertica" in record.getMessage()]
    assert len(messages) == 1
    assert messages[0].levelno == logging.DEBUG


def test_registered_dialect_is_returned_without_discovery(monkeypatch):
    """A dialect with an implementation resolves from the registry, without importing."""

    def unexpected_import(key: str, *_args, **_kwargs):
        raise AssertionError(f"discovery should not run for a registered dialect: {key}")

    monkeypatch.setattr(system_module, "import_from_module", unexpected_import)

    class VerticaSystemMetrics:
        """Stand-in for a real system metrics implementation."""

    SystemMetricsRegistry.register(SimpleNamespace(name="vertica"), VerticaSystemMetrics)

    assert SystemMetricsRegistry.get(SimpleNamespace(name="vertica")) is VerticaSystemMetrics
