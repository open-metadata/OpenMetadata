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
"""Stage backpressure collector.

The Queue class in `models/topology.py` calls into this module for every
put/process. When the collector is installed, those calls update the
counters and the heartbeat surfaces queue depths.
"""

import pytest

from metadata.ingestion.diagnostics import stage_progress
from metadata.ingestion.models.topology import Queue


@pytest.fixture(autouse=True)
def _reset_collector():
    """Tests install/uninstall the collector explicitly."""
    stage_progress.uninstall()
    yield
    stage_progress.uninstall()


def test_queue_is_no_op_without_collector():
    q = Queue(name="t")
    q.put(1)
    q.put(2)
    items = list(q.process())
    assert items == [1, 2]
    assert stage_progress.snapshot() == []


def test_collector_tracks_put_and_processed_counts():
    stage_progress.install(stage_progress.StageProgressCollector())
    q = Queue(name="source-to-sink")
    q.put("a")
    q.put("b")
    q.put("c")
    list(q.process())  # drain

    snap = stage_progress.snapshot()
    assert len(snap) == 1
    row = snap[0]
    assert row["name"] == "source-to-sink"
    assert row["put"] == 3
    assert row["processed"] == 3
    assert row["depth"] == 0


def test_depth_reflects_unprocessed_items():
    stage_progress.install(stage_progress.StageProgressCollector())
    q = Queue(name="t")
    q.put("a")
    q.put("b")
    snap = stage_progress.snapshot()
    assert snap[0]["depth"] == 2
    assert snap[0]["put"] == 2
    assert snap[0]["processed"] == 0


def test_format_for_heartbeat_returns_empty_string_with_no_queues():
    stage_progress.install(stage_progress.StageProgressCollector())
    assert stage_progress.format_for_heartbeat() == ""


def test_format_for_heartbeat_renders_known_queues():
    stage_progress.install(stage_progress.StageProgressCollector())
    q = Queue(name="src2sink")
    q.put("x")
    q.put("y")
    rendered = stage_progress.format_for_heartbeat()
    assert "stage_queues=src2sink:2(2->0)" in rendered


def test_multiple_queues_aggregated():
    stage_progress.install(stage_progress.StageProgressCollector())
    q1 = Queue(name="a")
    q2 = Queue(name="b")
    q1.put(1)
    q2.put(2)
    q2.put(3)
    names = {row["name"]: row for row in stage_progress.snapshot()}
    assert names["a"]["put"] == 1
    assert names["b"]["put"] == 2
