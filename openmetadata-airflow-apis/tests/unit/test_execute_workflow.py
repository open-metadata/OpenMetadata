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
Tests for the execute_workflow wrapper's teardown contract.

execute_workflow must always call workflow.stop() — even when
workflow.execute() raises — so the non-daemon RepeatedTimer thread and OM
client are cleaned up and the Airflow task doesn't hang at shutdown.
"""

from unittest.mock import MagicMock, call

import pytest

from openmetadata_managed_apis.workflows.ingestion.common import execute_workflow


def _make_config(raise_on_error: bool = False) -> MagicMock:
    config = MagicMock()
    config.workflowConfig.raiseOnError = raise_on_error
    return config


def test_execute_workflow_calls_stop_on_success():
    workflow = MagicMock()
    execute_workflow(workflow, _make_config())

    workflow.execute.assert_called_once()
    workflow.stop.assert_called_once()


def test_execute_workflow_stops_when_execute_raises():
    """The fix: stop() must run even when execute() raises, so the
    RepeatedTimer thread and OM client don't leak and hang the process."""
    workflow = MagicMock()
    workflow.execute.side_effect = RuntimeError("execute boom")

    with pytest.raises(RuntimeError, match="execute boom"):
        execute_workflow(workflow, _make_config())

    workflow.execute.assert_called_once()
    workflow.stop.assert_called_once()


def test_execute_workflow_stop_runs_before_raise_from_status():
    """stop() must run (in the finally) before raise_from_status() (which
    is outside the try/finally). Ordering: execute -> stop -> raise_from_status."""
    workflow = MagicMock()
    execute_workflow(workflow, _make_config(raise_on_error=True))

    assert workflow.mock_calls == [call.execute(), call.stop(), call.raise_from_status()]


def test_execute_workflow_stops_even_if_raise_from_status_raises():
    """Even if raise_from_status raises, stop() must already have run."""
    workflow = MagicMock()
    workflow.raise_from_status.side_effect = RuntimeError("status boom")

    with pytest.raises(RuntimeError, match="status boom"):
        execute_workflow(workflow, _make_config(raise_on_error=True))

    workflow.stop.assert_called_once()


def test_execute_workflow_skips_raise_from_status_when_disabled():
    workflow = MagicMock()
    execute_workflow(workflow, _make_config(raise_on_error=False))

    workflow.execute.assert_called_once()
    workflow.stop.assert_called_once()
    workflow.raise_from_status.assert_not_called()
