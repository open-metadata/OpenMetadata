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
"""Unit tests for the Dagster source metadata extraction."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from metadata.ingestion.source.pipeline.dagster.metadata import DagsterSource

METADATA_MODULE = "metadata.ingestion.source.pipeline.dagster.metadata"


def _make_source(lookback):
    """Build a DagsterSource without running the heavy base __init__."""
    source = DagsterSource.__new__(DagsterSource)
    source.source_config = MagicMock(statusLookbackDays=lookback)
    source.metadata = MagicMock()
    source.client = MagicMock()
    source.context = MagicMock()
    return source


def _wire_runs(source):
    """Give the source one task and two step-stat runs: one recent, one old."""
    task = MagicMock()
    task.name = "op1"
    pipeline_entity = MagicMock(tasks=[task])
    source.metadata.get_by_name.return_value = pipeline_entity

    now_seconds = datetime.now(timezone.utc).timestamp()
    old_seconds = (datetime.now(timezone.utc) - timedelta(days=10)).timestamp()
    recent_run = MagicMock(startTime=now_seconds)
    old_run = MagicMock(startTime=old_seconds)
    source.client.get_task_runs.return_value.solidHandle.stepStats.nodes = [
        recent_run,
        old_run,
    ]
    return recent_run, old_run


def test_lookback_filters_out_old_runs():
    source = _make_source(lookback=1)
    recent_run, _ = _wire_runs(source)
    source._get_task_status = MagicMock(return_value=iter([]))

    with patch(f"{METADATA_MODULE}.fqn.build"):
        list(source.yield_pipeline_status(MagicMock()))

    assert source._get_task_status.call_count == 1
    assert source._get_task_status.call_args.kwargs["run"] is recent_run


def test_no_lookback_keeps_all_runs():
    source = _make_source(lookback=None)
    _wire_runs(source)
    source._get_task_status = MagicMock(return_value=iter([]))

    with patch(f"{METADATA_MODULE}.fqn.build"):
        list(source.yield_pipeline_status(MagicMock()))

    assert source._get_task_status.call_count == 2


def _statuses(source, run):
    with patch(f"{METADATA_MODULE}.fqn.build", return_value="svc.pipeline"):
        return list(source._get_task_status(run=run, task_name="op1"))


def test_skipped_step_without_start_time_uses_end_time():
    """A step Dagster skipped has no startTime; it must not fail the record."""
    from metadata.generated.schema.entity.data.pipeline import StatusType
    from metadata.ingestion.source.pipeline.dagster.models import RunStepStats

    source = _make_source(lookback=None)
    run = RunStepStats(runId="run-1", startTime=None, endTime=1700000000.5, status="SKIPPED")

    [either] = _statuses(source, run)

    assert either.left is None
    status = either.right.pipeline_status
    assert status.timestamp.root == 1700000000500
    assert status.executionStatus == StatusType.Skipped
    assert status.taskStatus[0].executionStatus == StatusType.Skipped
    assert status.taskStatus[0].startTime is None


def test_step_without_any_time_is_skipped_not_an_error():
    from metadata.ingestion.source.pipeline.dagster.models import RunStepStats

    source = _make_source(lookback=None)
    run = RunStepStats(runId="run-2", startTime=None, endTime=None, status="SKIPPED")

    assert _statuses(source, run) == []


def test_started_step_keeps_its_start_time():
    from metadata.generated.schema.entity.data.pipeline import StatusType
    from metadata.ingestion.source.pipeline.dagster.models import RunStepStats

    source = _make_source(lookback=None)
    run = RunStepStats(runId="run-3", startTime=1700000000.0, endTime=1700000060.0, status="SUCCESS")

    [either] = _statuses(source, run)

    assert either.right.pipeline_status.timestamp.root == 1700000000000
    assert either.right.pipeline_status.executionStatus == StatusType.Successful
