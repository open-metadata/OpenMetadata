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
"""Progress counter behaviour for the shared UsageSource._iter."""

from datetime import datetime
from types import SimpleNamespace

from metadata.generated.schema.type.tableQuery import TableQueries, TableQuery
from metadata.ingestion.source.database.usage_source import UsageSource


class _ConcreteUsageSource(UsageSource):
    """UsageSource is abstract only because `create` (a per-connector
    classmethod, see e.g. SnowflakeQueryParserSource.create) is never
    implemented on the shared base. Satisfy the ABC so tests can
    instantiate the base class directly without touching connector code."""

    @classmethod
    def create(cls, config_dict, metadata, pipeline_name=None):
        raise NotImplementedError("not exercised by this test")


def _make_usage_source(batches, result_limit, start, end):
    """Build a UsageSource without its heavy __init__, wired with a fake
    get_table_query so _iter can be exercised in isolation."""
    source = _ConcreteUsageSource.__new__(_ConcreteUsageSource)
    source.__dict__["source_config"] = SimpleNamespace(resultLimit=result_limit)
    source.start = start
    source.end = end
    source.get_table_query = lambda: iter(batches)
    return source


def _query():
    return TableQuery(query="select 1", serviceName="svc")


class TestUsageProgress:
    def test_seeds_ceiling_and_reconciles_to_real_count(self):
        # 2-day span, resultLimit 1000 -> ceiling 2000; 3 real queries across 2 batches
        batches = [
            TableQueries(queries=[_query(), _query()]),
            TableQueries(queries=[_query()]),
        ]
        source = _make_usage_source(batches, result_limit=1000, start=datetime(2026, 1, 1), end=datetime(2026, 1, 3))

        list(UsageSource._iter(source))

        assert source.progress.global_counters() == [("Queries", 3, 3)]

    def test_ceiling_is_result_limit_times_days_before_reconcile(self):
        captured = {}

        def batches():
            # peek the seeded total after the first batch, before completion
            captured["mid"] = source.progress.global_counters()
            yield TableQueries(queries=[_query()])

        source = _make_usage_source(batches(), result_limit=1000, start=datetime(2026, 1, 1), end=datetime(2026, 1, 3))
        list(UsageSource._iter(source))

        # first observation: total seeded at resultLimit * 2 days = 2000
        assert captured["mid"] == [("Queries", 0, 2000)]
