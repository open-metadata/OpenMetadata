#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""BigQuery jobs are grouped by the storage key after a complete scan."""

from contextlib import nullcontext
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from google.cloud.bigquery import DatasetReference, TableReference
from pydantic import ValidationError
from sqlalchemy.orm import Session

from metadata.generated.schema.entity.data.table import DmlOperationType
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import BigQueryConnection
from metadata.profiler.metrics.system.bigquery import system
from metadata.profiler.metrics.system.bigquery.system import BigQuerySystemMetricsComputer
from metadata.utils.time_utils import datetime_to_timestamp

START = datetime(2026, 1, 2, 12, 0, tzinfo=timezone.utc)
DESTINATION = TableReference(DatasetReference("table-project", "orders_dataset"), "orders")
CREDENTIALS = {"gcpConfig": {"type": "gcp_adc"}}


def _job(job_id, *, project="billing-project", time=START, **counts):
    return {"job_project": project, "job_id": job_id, "start_time": time, **counts}


def _computer(rows):
    session = Mock(spec=Session)
    session.execute.return_value = nullcontext(SimpleNamespace(mappings=lambda: iter(rows)))
    config = BigQueryConnection.model_validate(
        {
            "credentials": CREDENTIALS,
            "billingProjectId": "billing-project",
            "usageLocation": "EU",
            "systemMetricsJobProjectIds": ["extra-project"],
        }
    )
    return BigQuerySystemMetricsComputer(session, DESTINATION, config, START)


def test_dml_jobs_in_the_same_millisecond_share_one_profile_per_operation():
    merge = _job("shared-id", inserted_row_count=7, deleted_row_count=1, updated_row_count=5)
    jobs = [
        merge,
        _job(
            "shared-id",
            project="extra-project",
            time=START + timedelta(microseconds=900),
            updated_row_count=3,
        ),
        merge.copy(),
        _job("next-update", time=START + timedelta(milliseconds=1), updated_row_count=2),
    ]

    profiles = _computer(jobs).get_system_metrics()

    timestamp = datetime_to_timestamp(START, milliseconds=True)
    assert [(profile.timestamp.root, profile.operation, profile.rowsAffected) for profile in profiles] == [
        (timestamp, DmlOperationType.DELETE, 1),
        (timestamp, DmlOperationType.INSERT, 7),
        (timestamp, DmlOperationType.UPDATE, 8),
        (timestamp + 1, DmlOperationType.UPDATE, 2),
    ]


@pytest.mark.parametrize("rows", [None, 0, -1])
def test_jobs_without_affected_rows_are_skipped(rows):
    jobs = [_job("quiet", updated_row_count=rows)]

    assert _computer(jobs).get_system_metrics() == []


def test_empty_job_history_is_a_successful_scan():
    assert _computer([]).get_system_metrics() == []


def test_conflicting_repeated_job_invalidates_the_scan():
    jobs = [_job("duplicate", inserted_row_count=1), _job("duplicate", inserted_row_count=2)]

    with pytest.raises(RuntimeError, match="Conflicting records for BigQuery job billing-project:duplicate"):
        _computer(jobs).get_system_metrics()


@pytest.mark.parametrize(
    "counts",
    [(-(2**31) - 1,), (2**31,), (2**31 - 1, 1)],
    ids=["single-job-underflow", "single-job-overflow", "operation-total-overflow"],
)
def test_counts_outside_the_backend_integer_range_invalidate_the_scan(counts):
    jobs = [_job(str(index), deleted_row_count=count) for index, count in enumerate(counts)]

    with pytest.raises(RuntimeError, match="rowsAffected range"):
        _computer(jobs).get_system_metrics()


def test_record_bound_counts_rows_even_when_a_job_repeats(monkeypatch):
    monkeypatch.setattr(system, "MAX_SYSTEM_METRICS_JOBS", 1)
    job = _job("duplicate", updated_row_count=1)

    with pytest.raises(RuntimeError, match="More than 1 BigQuery DML jobs"):
        _computer([job, job]).get_system_metrics()


def test_bin_bound_omits_all_operations(monkeypatch):
    monkeypatch.setattr(system, "MAX_SYSTEM_PROFILE_BINS", 1)
    job = _job("merge", inserted_row_count=1, updated_row_count=1)

    with pytest.raises(RuntimeError, match="More than 1 BigQuery system profile bins"):
        _computer([job]).get_system_metrics()


def test_failed_job_page_reports_scope_after_an_earlier_row():
    def interrupted_scan():
        yield _job("from-first-page", inserted_row_count=5)
        raise TimeoutError("job history read timed out")

    with pytest.raises(
        RuntimeError,
        match=r"table-project\.orders_dataset\.orders in EU across billing-project, extra-project.*timed out",
    ):
        _computer(interrupted_scan()).get_system_metrics()


@pytest.mark.parametrize(
    "setting",
    [
        {"systemMetricsLookbackDays": 0},
        {"systemMetricsLookbackDays": 31},
        {"systemMetricsJobProjectIds": ["proj"] * 11},
    ],
)
def test_connection_config_rejects_an_unbounded_job_history_scope(setting):
    with pytest.raises(ValidationError):
        BigQueryConnection.model_validate({"credentials": CREDENTIALS, **setting})
