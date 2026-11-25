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
The queries on the Dremio job history
"""

from datetime import datetime, timezone

import pytest

from metadata.ingestion.source.database.dremio.queries import (
    CLOUD_JOBS,
    SOFTWARE_JOBS,
    USAGE_FILTER,
    get_jobs_query,
    iter_table_queries,
)

START, END = datetime(2026, 11, 1, tzinfo=timezone.utc), datetime(2026, 11, 2, tzinfo=timezone.utc)


@pytest.mark.parametrize(
    ("jobs", "table", "start"),
    [
        # sys."jobs" of Dremio Software only lists the running jobs
        (SOFTWARE_JOBS, "FROM sys.jobs_recent", f"submitted_epoch_millis >= {int(START.timestamp() * 1_000)}"),
        (CLOUD_JOBS, "FROM sys.project.history.jobs", f"submitted_epoch >= {int(START.timestamp() * 1_000_000_000)}"),
    ],
)
def test_each_edition_reads_its_job_history(jobs, table, start):
    query = get_jobs_query(jobs, START, END, USAGE_FILTER, 100)

    assert table in query
    assert start in query
    assert f"NOT LIKE '%{jobs.name}%'" in query
    assert query.rstrip().endswith("LIMIT 100")


@pytest.mark.parametrize(("jobs", "scale"), [(SOFTWARE_JOBS, 1_000), (CLOUD_JOBS, 1_000_000_000)])
def test_epochs_are_read_in_the_unit_of_the_edition(jobs, scale):
    rows = [
        {"query": "SELECT 1", "user_name": "ada", "submitted_epoch": int(START.timestamp() * scale), "cpu_time": scale},
        {"query": None},
    ]

    (query,) = iter_table_queries(rows, jobs, "svc")

    assert query.startTime == START.isoformat()
    assert query.duration == 1
    assert query.userName == "ada"


@pytest.mark.parametrize(("jobs", "scale"), [(SOFTWARE_JOBS, 1_000), (CLOUD_JOBS, 1_000_000_000)])
def test_usage_is_counted_on_the_day_the_job_was_submitted(jobs, scale):
    submitted = datetime(2026, 10, 30, 23, 30, tzinfo=timezone.utc)
    rows = [{"query": "SELECT 1", "submitted_epoch": int(submitted.timestamp() * scale)}]

    (query,) = iter_table_queries(rows, jobs, "svc")

    assert query.analysisDate.root == submitted


def test_no_limit_when_the_result_limit_is_unset():
    query = get_jobs_query(SOFTWARE_JOBS, START, END, USAGE_FILTER, None)

    assert "LIMIT" not in query
    assert query.rstrip().endswith("DESC")
