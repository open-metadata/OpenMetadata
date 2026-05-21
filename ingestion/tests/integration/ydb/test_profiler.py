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
Integration test for the YDB profiler workflow.

Covers the four YDB-specific moving parts simultaneously:

- ``YdbSampler`` builds the ORM with ``__tablename__ = schema/table`` so
  YDB doesn't reject the query as ``Unknown cluster``.
- ``MedianFn`` for YDB emits ``PERCENTILE(CAST(col AS Double), p)``.
- ``StdDevFn`` for YDB emits ``STDDEV_POP(CAST(col AS Double))``.
- ``AvgFn`` for YDB emits ``avg(CAST(col AS Double))``.

If any of those misfires the profiler errors out on numeric columns.
"""

from copy import deepcopy

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


def test_profiler(
    patch_passwords_for_db_services,
    create_test_data,
    run_workflow,
    ingestion_config,
    profiler_config,
    metadata,
    db_service,
):
    search_cache.clear()
    config = deepcopy(ingestion_config)
    run_workflow(MetadataWorkflow, config)
    run_workflow(ProfilerWorkflow, profiler_config)

    service = db_service.fullyQualifiedName.root

    # raw.events: table-level row/column counts.
    events = metadata.get_latest_table_profile(
        fqn=f"{service}./local.raw.events"
    )
    assert events is not None and events.profile is not None
    assert events.profile.rowCount == 3.0
    assert events.profile.columnCount == 3.0

    # orders.amount: full numeric profile (exercises avg/stddev/median path).
    orders = metadata.get_latest_table_profile(
        fqn=f"{service}./local.default.orders"
    )
    assert orders is not None and orders.columns
    amount_col = next(c for c in orders.columns if c.name.root == "amount")
    assert amount_col.profile is not None
    assert amount_col.profile.valuesCount == 3.0
    assert amount_col.profile.min == 100.0
    assert amount_col.profile.max == 300.0
    assert amount_col.profile.mean == 200.0
    # Median, firstQuartile and thirdQuartile go through MedianFn → PERCENTILE.
    assert amount_col.profile.median is not None
    assert amount_col.profile.firstQuartile is not None
    assert amount_col.profile.thirdQuartile is not None
    # stddev goes through StdDevFn → STDDEV_POP.
    assert amount_col.profile.stddev is not None
