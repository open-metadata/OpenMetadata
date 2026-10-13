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
"""BigQuery system metrics must attribute each DML job only to its destination table."""

from datetime import datetime, timezone

import pytest

from metadata.generated.schema.entity.data.table import DmlOperationType
from metadata.ingestion.source.database.bigquery.queries import BigQueryQueryResult
from metadata.profiler.metrics.system.bigquery.system import BigQuerySystemMetricsComputer

START = datetime(2026, 1, 2, 12, 0, tzinfo=timezone.utc)


def _job(table, rows, *, project="proj", dataset="ds", minute=0):
    return BigQueryQueryResult(
        project_id=project,
        dataset_id=dataset,
        table_name=table,
        updated_row_count=rows,
        start_time=START.replace(minute=minute),
        statement_type="UPDATE",
    )


def _updates(jobs):
    profiles = BigQuerySystemMetricsComputer.get_system_profile(
        "proj", "ds", "orders", jobs, "updated_row_count", DmlOperationType.UPDATE
    )
    return [(profile.operation, profile.rowsAffected) for profile in profiles]


def test_dml_on_sibling_tables_is_not_attributed_to_the_profiled_table():
    jobs = [
        _job("orders", 1, minute=1),
        _job("customers", 7, minute=2),
        _job("orders", 3, project="other-proj", minute=3),
        _job("orders", 5, dataset="other_ds", minute=4),
    ]
    assert _updates(jobs) == [(DmlOperationType.UPDATE, 1)]


@pytest.mark.parametrize("rows", [None, 0])
def test_jobs_without_affected_rows_are_skipped(rows):
    assert _updates([_job("orders", rows), _job("orders", 2, minute=1)]) == [(DmlOperationType.UPDATE, 2)]


def test_unknown_rows_affected_field_is_rejected():
    with pytest.raises(ValueError, match="not a valid field"):
        BigQuerySystemMetricsComputer.get_system_profile(
            "proj", "ds", "orders", [], "rows_touched", DmlOperationType.UPDATE
        )
