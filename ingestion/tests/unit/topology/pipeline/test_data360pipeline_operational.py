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
Test the Salesforce Data 360 pipeline run-status (operational) source
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.data.pipeline import StatusType
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.data360pipeline.models import (
    CalculatedInsightDetails,
    DataStreamDetails,
    DataTransformDetails,
)
from metadata.ingestion.source.pipeline.data360pipeline.operational import (
    Data360PipelineOperationalSource,
)

MOCK_CONFIG = {
    "source": {
        "type": "data360pipeline",
        "serviceName": "local_data360pipeline",
        "serviceConnection": {
            "config": {
                "type": "Data360Pipeline",
                "consumerKey": "consumer_key",
                "consumerSecret": "consumer_secret",
                "salesforceDomain": "mycompany.my",
                "salesforceApiVersion": "63.0",
                "paginationLimit": 7,
                "data360DbServiceName": "local_data360",
            }
        },
        "sourceConfig": {
            "config": {
                "type": "PipelineMetadata",
                "statusLookbackDays": 3,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "data360pipeline"},
        }
    },
}


def _iso(days_ago: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _build_source() -> Data360PipelineOperationalSource:
    with (
        patch("metadata.ingestion.source.pipeline.data360pipeline.metadata.Data360PipelineSource.test_connection"),
        patch("metadata.ingestion.source.pipeline.data360pipeline.connection.Salesforce"),
    ):
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_CONFIG)
        source = Data360PipelineOperationalSource.create(
            MOCK_CONFIG["source"],
            OpenMetadata(config=config.workflowConfig.openMetadataServerConfig),
        )
    source.existing_pipelines_set = {"dt1", "ci1", "ds1"}
    return source


class TestPipelineStatusMapping:
    @pytest.mark.parametrize(
        "raw_status,expected",
        [
            ("SUCCESS", StatusType.Successful),
            # The keyword is not at the start of the string: with `re.match` this
            # fell through to Pending and a successful run was reported as running.
            ("COMPLETED SUCCESSFULLY", StatusType.Successful),
            ("REFRESH_FAILED", StatusType.Failed),
            ("Failure", StatusType.Failed),
            ("SKIPPED_NO_CHANGES", StatusType.Skipped),
            ("RUNNING", StatusType.Pending),
            ("", StatusType.Pending),
        ],
    )
    def test_status_keyword_is_matched_anywhere_in_the_string(self, raw_status, expected):
        source = _build_source()
        assert source._get_pipeline_status_type(raw_status) == expected

    def test_a_status_naming_both_outcomes_is_reported_as_failed(self):
        source = _build_source()
        assert source._get_pipeline_status_type("PARTIAL SUCCESS - SOME ROWS FAILED") == StatusType.Failed


class TestDataTransformStatus:
    def test_run_history_uses_the_connection_pagination_limit(self):
        # Regression test: this used to read `source_config.lastRunsLimit`, which is
        # not a field of PipelineServiceMetadataPipeline, so every Data Transform
        # status raised AttributeError and was reported as a failure.
        source = _build_source()
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.operational.get_data_transform_run_history",
            return_value={"histories": []},
        ) as mock_history:
            list(source.yield_data_transform_status(DataTransformDetails(name="dt1")))
        assert mock_history.call_args.kwargs["limit"] == 7

    def test_runs_older_than_the_status_lookback_window_are_dropped(self):
        source = _build_source()
        histories = {
            "histories": [
                {"startTime": _iso(0.5), "endTime": _iso(0.4), "status": "SUCCESS"},
                {"startTime": _iso(30), "endTime": _iso(30), "status": "SUCCESS"},
            ]
        }
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.operational.get_data_transform_run_history",
            return_value=histories,
        ):
            results = list(source.yield_data_transform_status(DataTransformDetails(name="dt1")))
        assert len(results) == 1
        status = results[0].right.pipeline_status
        assert status.executionStatus == StatusType.Successful

    def test_status_record_carries_the_run_window_and_fqn(self):
        source = _build_source()
        histories = {"histories": [{"startTime": _iso(0.2), "endTime": _iso(0.1), "status": "REFRESH_FAILED"}]}
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.operational.get_data_transform_run_history",
            return_value=histories,
        ):
            results = list(source.yield_data_transform_status(DataTransformDetails(name="dt1")))
        record = results[0].right
        assert record.pipeline_fqn == "local_data360pipeline.dt1"
        assert record.pipeline_status.executionStatus == StatusType.Failed
        task = record.pipeline_status.taskStatus[0]
        assert task.name == "dt1"
        assert task.startTime.root < task.endTime.root
        assert record.pipeline_status.timestamp.root == task.startTime.root

    def test_a_run_without_an_end_time_is_dropped_with_a_warning(self):
        source = _build_source()
        histories = {"histories": [{"startTime": _iso(0.2), "status": "SUCCESS"}]}
        with patch(
            "metadata.ingestion.source.pipeline.data360pipeline.operational.get_data_transform_run_history",
            return_value=histories,
        ):
            results = list(source.yield_data_transform_status(DataTransformDetails(name="dt1")))
        assert results == []
        assert len(source.status.warnings) == 1


class TestCalculatedInsightAndDataStreamStatus:
    def test_calculated_insight_status_uses_its_last_run_window(self):
        source = _build_source()
        details = CalculatedInsightDetails(
            apiName="ci1",
            lastRunDateTime="2024-01-01T00:00:00Z",
            lastRunStatusDateTime="2024-01-01T01:00:00Z",
            lastRunStatus="SUCCESS",
        )
        results = list(source.yield_ci_status(details))
        status = results[0].right.pipeline_status
        assert status.executionStatus == StatusType.Successful
        assert status.taskStatus[0].startTime.root == 1704067200000
        assert status.taskStatus[0].endTime.root == 1704070800000

    def test_datastream_status_uses_the_refresh_date_for_both_ends(self):
        source = _build_source()
        details = DataStreamDetails(name="ds1", lastRefreshDate="2024-01-01T00:00:00Z", lastRunStatus="SUCCESS")
        results = list(source.yield_datastream_status(details))
        task = results[0].right.pipeline_status.taskStatus[0]
        assert task.startTime.root == task.endTime.root == 1704067200000

    def test_a_datastream_that_never_refreshed_is_dropped_with_a_warning(self):
        source = _build_source()
        details = DataStreamDetails(name="ds1", lastRunStatus="SUCCESS")
        assert list(source.yield_datastream_status(details)) == []
        assert len(source.status.warnings) == 1


class TestYieldPipelineStatusDispatch:
    def test_a_pipeline_absent_from_openmetadata_is_warned_not_failed(self):
        source = _build_source()
        source.existing_pipelines_set = set()
        results = list(source.yield_pipeline_status(DataTransformDetails(name="dt1")))
        assert results == []
        assert len(source.status.warnings) == 1
        assert not source.status.failures

    def test_dispatch_routes_a_datastream_to_the_datastream_extractor(self):
        source = _build_source()
        details = DataStreamDetails(name="ds1", lastRefreshDate="2024-01-01T00:00:00Z", lastRunStatus="SUCCESS")
        results = list(source.yield_pipeline_status(details))
        assert len(results) == 1
        assert results[0].right.pipeline_fqn == "local_data360pipeline.ds1"

    def test_an_unexpected_error_is_reported_as_a_stack_trace_error(self):
        source = _build_source()
        with patch.object(source, "yield_data_transform_status", side_effect=RuntimeError("boom")):
            results = list(source.yield_pipeline_status(DataTransformDetails(name="dt1")))
        assert len(results) == 1
        assert results[0].right is None
        assert "boom" in results[0].left.error
