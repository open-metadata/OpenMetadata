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
"""Persisted Postgres profiler values for portable and native tables."""

import pytest

from ..features.database.entities import entity_exists
from ..features.database.pipelines import MetadataPipeline, ProfilerPipeline
from ..features.database.profiles import column_has_metrics, table_has_row_count
from ..runtime import expect


@pytest.mark.e2e_contract("profile.metrics")
def test_profiler_metrics(cli, postgres):
    cli.run(postgres.invocation(MetadataPipeline()))
    for name in ("customers", "transactions", "all_datatypes"):
        expect.poll(postgres.table_query(name)).satisfies(entity_exists)
    cli.run(
        postgres.invocation(
            ProfilerPipeline(useStatistics=False),
            filters={"tableFilterPattern": {"includes": ["^(customers|transactions|all_datatypes)$"]}},
        )
    )
    for name, count in (("customers", 5), ("transactions", 5), ("all_datatypes", 1)):
        expect.poll(postgres.profile_query(name)).satisfies(table_has_row_count(count))
    expect.poll(postgres.profile_query("customers")).satisfies(
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
