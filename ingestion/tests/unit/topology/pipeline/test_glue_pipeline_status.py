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
"""Tests for ``yield_pipeline_status`` in the Glue pipeline connector.

AWS Glue omits ``CompletedOn`` for runs that have not terminated
(``STARTING``/``RUNNING``/``STOPPING``/``WAITING``). These tests confirm such
runs are emitted with a null end time and do not discard the remaining runs
of the job, mirroring the contract honored by sibling pipeline connectors
(Databricks, Airflow) where ``endTime`` is optional.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from metadata.generated.schema.entity.data.pipeline import StatusType
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.gluepipeline.metadata import GluepipelineSource
from metadata.utils.time_utils import datetime_to_timestamp

GLUE_CONFIG = {
    "source": {
        "type": "gluepipeline",
        "serviceName": "local_gluepipeline",
        "serviceConnection": {
            "config": {
                "type": "GluePipeline",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-2",
                    "endPointURL": "https://endpoint.com/",
                },
            },
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

PIPELINE_FQN = "local_gluepipeline.redshift workflow"
JOB_NAME = "Redshift DBT Job"

# Glue returns runs newest-first; mirror that ordering in the fixtures so the
# tests reflect the real-world shape that triggered the bug.
STARTED_OLDEST = datetime(2024, 9, 28, 10, 0, 0, tzinfo=timezone.utc)
STARTED_MIDDLE = datetime(2024, 9, 29, 10, 0, 0, tzinfo=timezone.utc)
STARTED_NEWEST = datetime(2024, 9, 30, 17, 7, 59, tzinfo=timezone.utc)
COMPLETED_NEWEST = datetime(2024, 9, 30, 17, 8, 3, tzinfo=timezone.utc)


def _run(state, started_on, completed_on=None, *, job_name=JOB_NAME, drop_fields=()):
    """Build a boto3-shaped JobRun dict. Omits ``CompletedOn`` when ``None``."""
    run = {
        "Id": f"jr_{job_name}_{state}_{int(started_on.timestamp())}",
        "Attempt": 0,
        "JobName": job_name,
        "JobRunState": state,
        "StartedOn": started_on,
    }
    if completed_on is not None:
        run["CompletedOn"] = completed_on
    for field in drop_fields:
        run.pop(field, None)
    return run


@pytest.fixture
def glue_source():
    with patch("metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"):
        config = OpenMetadataWorkflowConfig.model_validate(GLUE_CONFIG)
        source = GluepipelineSource.create(
            GLUE_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
    source.metadata = MagicMock()
    source.glue = MagicMock()
    source.context.get().__dict__["pipeline"] = "redshift workflow"
    source.context.get().__dict__["pipeline_service"] = "local_gluepipeline"
    with patch(
        "metadata.ingestion.source.pipeline.gluepipeline.metadata.fqn.build",
        return_value=PIPELINE_FQN,
    ):
        yield source


def _set_runs(source, runs, *, job_name=JOB_NAME):
    source.job_name_list = {job_name}
    source.glue.get_job_runs.return_value = {"JobRuns": list(runs)}


class TestYieldPipelineStatusTerminatedRuns:
    """Regression guard: terminated runs keep working exactly as before."""

    def test_succeeded_run_yields_status_with_end_time(self, glue_source):
        _set_runs(glue_source, [_run("SUCCEEDED", STARTED_NEWEST, COMPLETED_NEWEST)])

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 1
        assert isinstance(results[0].right, OMetaPipelineStatus)
        status = results[0].right.pipeline_status
        assert status.executionStatus == StatusType.Successful
        assert status.taskStatus[0].name == JOB_NAME
        assert status.taskStatus[0].executionStatus == StatusType.Successful
        assert status.taskStatus[0].startTime.root == datetime_to_timestamp(STARTED_NEWEST, milliseconds=True)
        assert status.taskStatus[0].endTime.root == datetime_to_timestamp(COMPLETED_NEWEST, milliseconds=True)
        assert status.timestamp.root == datetime_to_timestamp(STARTED_NEWEST, milliseconds=True)
        assert results[0].right.pipeline_fqn == PIPELINE_FQN

    def test_failed_run_maps_to_failed_status(self, glue_source):
        _set_runs(glue_source, [_run("FAILED", STARTED_NEWEST, COMPLETED_NEWEST)])

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 1
        assert results[0].right.pipeline_status.executionStatus == StatusType.Failed
        assert results[0].right.pipeline_status.taskStatus[0].executionStatus == StatusType.Failed


class TestYieldPipelineStatusInFlightRuns:
    """The bug: in-flight runs (no ``CompletedOn``) must not crash the loop."""

    def test_running_run_without_completed_on_yields_null_end_time(self, glue_source):
        _set_runs(glue_source, [_run("RUNNING", STARTED_NEWEST)])

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 1
        assert isinstance(results[0].right, OMetaPipelineStatus)
        status = results[0].right.pipeline_status
        assert status.executionStatus == StatusType.Pending
        assert status.taskStatus[0].executionStatus == StatusType.Pending
        assert status.taskStatus[0].endTime is None
        assert status.taskStatus[0].startTime.root == datetime_to_timestamp(STARTED_NEWEST, milliseconds=True)
        assert status.timestamp.root == datetime_to_timestamp(STARTED_NEWEST, milliseconds=True)

    @pytest.mark.parametrize(
        "state",
        [
            pytest.param("STARTING", id="starting"),
            pytest.param("RUNNING", id="running"),
            pytest.param("STOPPING", id="stopping"),
            pytest.param("WAITING", id="waiting"),
        ],
    )
    def test_nonterminated_state_maps_to_pending_with_null_end_time(self, glue_source, state):
        _set_runs(glue_source, [_run(state, STARTED_NEWEST)])

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 1
        assert results[0].right.pipeline_status.executionStatus == StatusType.Pending
        assert results[0].right.pipeline_status.taskStatus[0].executionStatus == StatusType.Pending
        assert results[0].right.pipeline_status.taskStatus[0].endTime is None

    def test_unknown_state_falls_back_to_pending(self, glue_source):
        _set_runs(glue_source, [_run("SOME_NEW_GLUE_STATE", STARTED_NEWEST)])

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 1
        assert results[0].right.pipeline_status.executionStatus == StatusType.Pending


class TestYieldPipelineStatusDoesNotDiscardRuns:
    """The bug's core impact: one bad run must not discard the others."""

    def test_newest_running_does_not_discard_historical_runs(self, glue_source):
        """Real-world shape: Glue returns runs newest-first, and the newest is
        still running (no ``CompletedOn``). Before the fix this dropped every
        status record for the job; it must now emit all of them."""
        _set_runs(
            glue_source,
            [
                _run("RUNNING", STARTED_NEWEST),
                _run("FAILED", STARTED_MIDDLE, STARTED_MIDDLE),
                _run("SUCCEEDED", STARTED_OLDEST, STARTED_OLDEST),
            ],
        )

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 3
        assert all(isinstance(r.right, OMetaPipelineStatus) for r in results)
        assert [r.right.pipeline_status.executionStatus for r in results] == [
            StatusType.Pending,
            StatusType.Failed,
            StatusType.Successful,
        ]
        assert [r.right.pipeline_status.taskStatus[0].endTime is None for r in results] == [
            True,
            False,
            False,
        ]

    def test_one_run_raising_does_not_discard_remaining_runs(self, glue_source):
        """A run missing ``StartedOn`` (unexpected) raises inside the per-run
        try/except; that run yields a left, the others still yield rights."""
        _set_runs(
            glue_source,
            [
                _run("SUCCEEDED", STARTED_NEWEST, COMPLETED_NEWEST, drop_fields=("StartedOn",)),
                _run("SUCCEEDED", STARTED_MIDDLE, STARTED_MIDDLE),
            ],
        )

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 2
        assert isinstance(results[0].left, StackTraceError)
        assert "Failed to yield pipeline status for job" in results[0].left.error
        assert isinstance(results[1].right, OMetaPipelineStatus)
        assert results[1].right.pipeline_status.executionStatus == StatusType.Successful

    def test_get_job_runs_failure_yields_left_and_continues_next_job(self, glue_source):
        """``get_job_runs`` failure for one job yields a left for that job and
        the connector still emits runs for the other jobs."""

        def _get_job_runs(JobName):  # noqa: N803
            if JobName == "broken_job":
                raise RuntimeError("throttled")
            return {"JobRuns": [_run("SUCCEEDED", STARTED_NEWEST, COMPLETED_NEWEST, job_name=JobName)]}

        glue_source.job_name_list = {"broken_job", "good_job"}
        glue_source.glue.get_job_runs.side_effect = _get_job_runs

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        by_name = {}
        for r in results:
            if r.right is not None:
                by_name[r.right.pipeline_status.taskStatus[0].name] = r.right
            else:
                by_name["__error__"] = r.left

        assert isinstance(by_name["__error__"], StackTraceError)
        assert "Failed to get job runs for job broken_job" in by_name["__error__"].error
        assert isinstance(by_name["good_job"], OMetaPipelineStatus)
        assert by_name["good_job"].pipeline_status.executionStatus == StatusType.Successful


class TestYieldPipelineStatusContract:
    """Shape guarantees each emitted status must satisfy."""

    def test_pipeline_fqn_and_timestamp_on_every_right(self, glue_source):
        _set_runs(
            glue_source,
            [
                _run("RUNNING", STARTED_NEWEST),
                _run("SUCCEEDED", STARTED_OLDEST, STARTED_OLDEST),
            ],
        )

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 2
        for r in results:
            assert isinstance(r.right, OMetaPipelineStatus)
            assert r.right.pipeline_fqn == PIPELINE_FQN
            assert r.right.pipeline_status.timestamp is not None


class TestYieldPipelineStatusStateMapping:
    """Exhaustive STATUS_MAP coverage, mirroring test_domopipeline."""

    @pytest.mark.parametrize(
        ("state", "expected"),
        [
            pytest.param("SUCCEEDED", StatusType.Successful, id="succeeded"),
            pytest.param("succeeded", StatusType.Successful, id="lowercase-succeeded"),
            pytest.param("FAILED", StatusType.Failed, id="failed"),
            pytest.param("CANCELLED", StatusType.Failed, id="cancelled"),
            pytest.param("INCOMPLETE", StatusType.Failed, id="incomplete"),
            pytest.param("PENDING", StatusType.Pending, id="pending"),
        ],
    )
    def test_terminated_state_mapping(self, glue_source, state, expected):
        _set_runs(glue_source, [_run(state, STARTED_NEWEST, COMPLETED_NEWEST)])

        results = list(glue_source.yield_pipeline_status(pipeline_details={}))

        assert len(results) == 1
        assert results[0].right.pipeline_status.executionStatus == expected
        assert results[0].right.pipeline_status.taskStatus[0].executionStatus == expected
