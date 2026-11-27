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
"""Persisted Exasol profiler metrics."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect
from .baseline import NATIVE_ROWS, NATIVE_TABLE

_PROFILED_TABLES = ("customers", "transactions", NATIVE_TABLE)


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, exasol):
    """v1 asserted rowCount 2 on its datatypes table; here every owned table and real column metrics."""
    filters = {"tableFilterPattern": {"includes": [f"^({'|'.join(_PROFILED_TABLES)})$"]}}
    cli.run(exasol.invocation(MetadataPipeline(), filters=filters))
    for name in _PROFILED_TABLES:
        expect.poll(exasol.table_query(name)).satisfies(entity_exists)
    cli.run(exasol.invocation(ProfilerPipeline(useStatistics=False), filters=filters))
    for name, count in (("customers", 5), ("transactions", 5), (NATIVE_TABLE, len(NATIVE_ROWS))):
        expect.poll(exasol.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(exasol.profile_query("customers")).satisfies(
        column_has_metrics(
            "credit_score",
            valuesCount=5,
            nullCount=0,
            distinctCount=5,
            min=600,
            max=750,
            mean=680,
            sum=3400,
        )
    )
    expect.poll(exasol.profile_query(NATIVE_TABLE)).satisfies(
        column_has_metrics("col_decimal", valuesCount=2, nullCount=0, min=-18.5, max=18.5, sum=0)
    )
