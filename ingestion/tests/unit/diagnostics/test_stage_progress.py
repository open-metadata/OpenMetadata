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
"""Stage progress collector behavior + the Queue seam routing through it."""

from typing import Any

import pytest

from metadata.ingestion.diagnostics.collectors.http import HttpTracker
from metadata.ingestion.diagnostics.collectors.operation_registry import OperationRegistry
from metadata.ingestion.diagnostics.collectors.stage_progress import StageProgressCollector
from metadata.ingestion.diagnostics.config import DiagnosticsConfig
from metadata.ingestion.diagnostics.handler import DiagnosticsHandler
from metadata.ingestion.diagnostics.kernel import get_handler, set_handler
from metadata.ingestion.diagnostics.monitors.watchdog import Watchdog
from metadata.ingestion.diagnostics.samplers.memory import MemoryTracker
from metadata.ingestion.diagnostics.samplers.time_accounting import TimeAccountingSampler
from metadata.ingestion.models.topology import Queue


def _build_handler() -> DiagnosticsHandler:
    config = DiagnosticsConfig()
    registry = OperationRegistry()
    memory = MemoryTracker()
    return DiagnosticsHandler(
        config=config,
        aspects=[
            registry,
            HttpTracker(),
            memory,
            TimeAccountingSampler(registry),
            StageProgressCollector(),
        ],
        watchdog=Watchdog(registry, memory, config),
        db_introspector=None,
        workflow=None,
    )


@pytest.fixture
def installed_handler() -> Any:
    handler = _build_handler()
    set_handler(handler)
    yield handler
    set_handler(None)


@pytest.fixture(autouse=True)
def _no_lingering_handler():
    """Each test starts with no installed handler."""
    set_handler(None)
    yield
    set_handler(None)


def test_queue_is_no_op_when_handler_is_not_installed():
    assert get_handler() is None
    queue = Queue(name="t")
    queue.put(1)
    queue.put(2)
    assert list(queue.process()) == [1, 2]


def test_collector_tracks_put_and_processed_counts(installed_handler):
    stage = installed_handler.aspect(StageProgressCollector)
    queue = Queue(name="source-to-sink")
    queue.put("a")
    queue.put("b")
    queue.put("c")
    list(queue.process())  # drain

    snapshot = stage.snapshot()
    assert len(snapshot) == 1
    row = snapshot[0]
    assert row["name"] == "source-to-sink"
    assert row["put"] == 3
    assert row["processed"] == 3
    assert row["depth"] == 0


def test_depth_reflects_unprocessed_items(installed_handler):
    stage = installed_handler.aspect(StageProgressCollector)
    queue = Queue(name="t")
    queue.put("a")
    queue.put("b")
    row = stage.snapshot()[0]
    assert row["depth"] == 2
    assert row["put"] == 2
    assert row["processed"] == 0


def test_render_instant_empty_with_no_queues(installed_handler):
    stage = installed_handler.aspect(StageProgressCollector)
    assert stage.render_instant() == ""


def test_render_instant_renders_known_queues(installed_handler):
    stage = installed_handler.aspect(StageProgressCollector)
    queue = Queue(name="src2sink")
    queue.put("x")
    queue.put("y")
    assert "stage_queues=src2sink:2(2->0)" in stage.render_instant()


def test_multiple_queues_aggregated(installed_handler):
    stage = installed_handler.aspect(StageProgressCollector)
    queue_a = Queue(name="a")
    queue_b = Queue(name="b")
    queue_a.put(1)
    queue_b.put(2)
    queue_b.put(3)
    by_name = {row["name"]: row for row in stage.snapshot()}
    assert by_name["a"]["put"] == 1
    assert by_name["b"]["put"] == 2
