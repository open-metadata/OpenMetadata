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
"""Persisted Athena profiler values for Hive, partitioned and Iceberg tables."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect

_PROFILED = {"customers": 5, "orders": 5, "sales": 3, "all_datatypes": 1}


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, athena):
    """v1 profiled at least two tables; here every table format reports exact values."""
    filters = {"tableFilterPattern": {"includes": [f"^({'|'.join(_PROFILED)})$"]}}
    cli.run(athena.invocation(MetadataPipeline(), filters=filters))
    for name in _PROFILED:
        expect.poll(athena.table_query(name)).satisfies(entity_exists)
    cli.run(athena.invocation(ProfilerPipeline(useStatistics=False), filters=filters))
    for name, count in _PROFILED.items():
        expect.poll(athena.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(athena.profile_query("customers")).satisfies(
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
