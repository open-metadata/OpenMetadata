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
"""Progress counter behaviour for the legacy lineage query path."""

from types import SimpleNamespace
from unittest.mock import patch

from metadata.generated.schema.type.tableQuery import TableQuery
from metadata.ingestion.source.database.lineage_source import LineageSource


class _ConcreteLineageSource(LineageSource):
    """LineageSource is abstract only because `create` (a per-connector
    classmethod, see e.g. SnowflakeLineageSource.create) is never
    implemented on the shared base. Satisfy the ABC so tests can
    instantiate the base class directly without touching connector code."""

    @classmethod
    def create(cls, config_dict, metadata, pipeline_name=None):
        raise NotImplementedError("not exercised by this test")


def _lineage_source(result_limit, produced_queries):
    source = _ConcreteLineageSource.__new__(_ConcreteLineageSource)
    source.__dict__["source_config"] = SimpleNamespace(
        resultLimit=result_limit,
        processCrossDatabaseLineage=None,
        crossDatabaseServiceNames=None,
        parsingTimeoutLimit=None,
        threads=0,
    )
    source.service_connection = SimpleNamespace(type=SimpleNamespace(value="snowflake"))
    source.metadata = None
    source.graph = None
    source.config = SimpleNamespace(serviceName="svc")
    source.get_query_parser_type = lambda: None
    source.query_lineage_producer = lambda: iter(produced_queries)
    return source


class TestLegacyLineageProgress:
    def test_producer_wrapper_tracks_and_reconciles_queries(self):
        produced = [TableQuery(query="select 1", serviceName="svc") for _ in range(4)]
        source = _lineage_source(result_limit=1000, produced_queries=produced)

        # Replace the heavy multiprocessing driver with one that just drains the
        # (wrapped) producer, which is what advances the counter.
        def fake_generate(producer_fn, processor_fn, args, **kwargs):
            for _ in producer_fn():
                yield from ()

        with patch.object(LineageSource, "generate_lineage_with_processes", staticmethod(fake_generate)):
            list(LineageSource.yield_query_lineage(source))

        assert source.progress.global_counters() == [("Queries", 4, 4)]
