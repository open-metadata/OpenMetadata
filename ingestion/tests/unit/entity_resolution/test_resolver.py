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

"""Run-scoped resolution against the real SDK with a fake HTTP boundary."""

import gc
import weakref
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import MagicMock
from urllib.parse import parse_qs, unquote, urlsplit
from uuid import uuid4

import pytest

from metadata.entity_resolution.engine import (
    EntityResolutionPlan,
    EntityResolver,
    FqnCandidate,
    FqnLookupMode,
    ResolutionTier,
)
from metadata.entity_resolution.table import TableResolver
from metadata.generated.schema.entity.data.table import DataModel, Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.type.queryParserData import ParsedData, QueryParserData
from metadata.generated.schema.type.tableSharding import TableSharding
from metadata.ingestion.lineage.sql_lineage import search_table_entities
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.hex.cell_lineage import ChainedCells
from metadata.ingestion.source.dashboard.hex.metadata import HexSource, TableSearchError
from metadata.ingestion.source.dashboard.hex.models import Cell, DataConnection
from metadata.ingestion.source.dashboard.hex.query_fetcher import HexQueryFetcher
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.ingestion.stage.table_usage import TableStageConfig, TableUsageStage
from metadata.utils.lru_cache import LRUCache

EXACT = FqnLookupMode.EXACT
CI = FqnLookupMode.CASE_INSENSITIVE_EXACT
WILDCARD = FqnLookupMode.WILDCARD
NAME = "my_service.my_db.my_schema.my_table"


def table(name=NAME, **kwargs):
    return Table(id=uuid4(), name=name.rsplit(".", 1)[-1], fullyQualifiedName=name, columns=[], **kwargs)


def plan(name=NAME, mode=EXACT, **kwargs):
    return EntityResolutionPlan(Table, (ResolutionTier((FqnCandidate(name, mode),)),), **kwargs)


class Transport:
    def __init__(self):
        self.entities = {}
        self.hits = []
        self.total = None
        self.relation = "eq"
        self.partial = {}
        self.requests = []
        self.error = None
        self.closed = False

    def get(self, path):
        parsed = urlsplit(path)
        params = parse_qs(parsed.query)
        self.requests.append((unquote(parsed.path), params))
        if self.error:
            raise self.error
        if parsed.path == "/search/query":
            return {"hits": {"hits": [], "total": {"value": 0, "relation": "eq"}}}
        if parsed.path == "/search/fieldQuery":
            return {
                "hits": {
                    "total": {"value": len(self.hits) if self.total is None else self.total, "relation": self.relation},
                    "hits": [{"_source": {"fullyQualifiedName": name}} for name in self.hits],
                },
                **self.partial,
            }
        name = unquote(parsed.path.split("/name/", 1)[1])
        entity = self.entities.get(name)
        if entity is None:
            raise APIError({"code": 404, "message": "not found"})
        return entity.model_dump(mode="json")

    def close(self):
        self.closed = True


@pytest.fixture
def sdk():
    metadata = OpenMetadata(
        OpenMetadataConnection(
            hostPort="http://localhost:8585/api", authProvider="openmetadata", securityConfig={"jwtToken": "test-token"}
        )
    )
    transport = Transport()
    metadata.client = transport
    return metadata, transport


def ids(entities):
    return [entity.id for entity in entities]


def test_exact_resolution_bypasses_search_and_isolated_runs_refresh_ids(sdk):
    metadata, transport = sdk
    old = table()
    transport.entities[NAME] = old
    first = EntityResolver(metadata)
    assert ids(first.resolve(plan())) == [old.id]
    new = table()
    transport.entities[NAME] = new
    assert ids(first.resolve(plan())) == [old.id]
    second = EntityResolver(metadata)
    assert ids(second.resolve(plan())) == [new.id]
    assert all(path != "/search/fieldQuery" for path, _ in transport.requests)


@pytest.mark.parametrize("mode", [EXACT, CI, WILDCARD])
def test_misses_and_errors_are_retried(sdk, mode):
    metadata, transport = sdk
    resolver = EntityResolver(metadata)
    request = plan(mode=mode)
    assert resolver.resolve(request) == ()
    transport.error = APIError({"code": 503, "message": "temporarily unavailable"})
    with pytest.raises(APIError):
        resolver.resolve(request)
    transport.error = None
    created = table()
    transport.entities[NAME] = created
    transport.hits = [NAME]
    assert ids(resolver.resolve(request)) == [created.id]


def test_tiers_union_deduplicate_sort_and_stop_at_first_nonempty(sdk):
    metadata, transport = sdk
    a, b, lower = table(NAME + "a"), table(NAME + "b"), table(NAME + "z")
    transport.entities = {item.fullyQualifiedName.root: item for item in (a, b, lower)}
    request = EntityResolutionPlan(
        Table,
        (
            ResolutionTier((FqnCandidate(NAME, EXACT),)),
            ResolutionTier(tuple(FqnCandidate(item.fullyQualifiedName.root, EXACT) for item in (b, a, b))),
            ResolutionTier((FqnCandidate(lower.fullyQualifiedName.root, EXACT),)),
        ),
    )
    assert ids(EntityResolver(metadata).resolve(request)) == [a.id, b.id]


def test_search_candidates_are_rehydrated_not_cached_in_sdk(sdk):
    metadata, transport = sdk
    actual = NAME.upper()
    old = table(actual)
    transport.hits = [actual, actual, NAME + "_other"]
    transport.entities[actual] = old
    request = plan(mode=CI)
    first = EntityResolver(metadata)
    assert ids(first.resolve(request)) == [old.id]
    new = table(actual)
    transport.entities[actual] = new
    assert ids(EntityResolver(metadata).resolve(request)) == [new.id]
    transport.entities.clear()
    assert EntityResolver(metadata).resolve(request) == ()


@pytest.mark.parametrize(
    "pattern,name,expected",
    [
        ("my_service.*.*.my_table", NAME, True),
        ("my_service.*.my_table", NAME, False),
        ('my_service.my_db.*."my.table"', 'my_service.my_db.my_schema."my.table"', True),
        (r"my_service.*.*.my\*table", "my_service.my_db.my_schema.my*table", True),
        (r"my_service.*.*.my\*table", NAME, False),
        ("my_service.*.*.my?table", NAME, True),
    ],
)
def test_wildcard_validates_components_quotes_and_literal_metacharacters(sdk, pattern, name, expected):
    metadata, transport = sdk
    entity = table(name)
    transport.entities[name] = entity
    transport.hits = [name]
    result = EntityResolver(metadata).resolve(plan(pattern, WILDCARD))
    assert ids(result) == ([entity.id] if expected else [])


def test_literal_search_encodes_reserved_characters_and_escapes_wildcards(sdk):
    metadata, transport = sdk
    name = 'my_service.my_db.my_schema."a*?&+ b"'
    entity = table(name)
    transport.entities[name] = entity
    transport.hits = [name]
    assert ids(EntityResolver(metadata).resolve(plan(name, CI))) == [entity.id]
    path, params = transport.requests[0]
    assert path == "/search/fieldQuery"
    assert params["fieldValue"] == [r'my_service.my_db.my_schema."a\*\?&+ b"']
    assert params["deleted"] == ["false"]
    assert params["size"] == ["11"]


@pytest.mark.parametrize(
    "total,relation,hits,error",
    [
        (11, "eq", 11, "limit"),
        (11, "eq", 10, "limit"),
        (2, "eq", 1, "Incomplete"),
        (1, "gte", 1, "Incomplete"),
    ],
)
def test_overflow_and_incomplete_results_fail_and_retry(sdk, total, relation, hits, error):
    metadata, transport = sdk
    transport.total, transport.relation = total, relation
    transport.hits = [NAME] * hits
    resolver = EntityResolver(metadata)
    with pytest.raises(ValueError, match=error):
        resolver.resolve(plan(mode=CI))
    entity = table()
    transport.entities[NAME] = entity
    transport.total, transport.relation, transport.hits = 1, "eq", [NAME]
    assert ids(resolver.resolve(plan(mode=CI))) == [entity.id]


@pytest.mark.parametrize("partial", [{"timed_out": True}, {"_shards": {"failed": 1}}])
def test_partial_search_response_is_not_a_match(sdk, partial):
    metadata, transport = sdk
    transport.partial = partial
    transport.hits = [NAME]
    transport.entities[NAME] = table()
    with pytest.raises(ValueError):
        EntityResolver(metadata).resolve(plan(mode=CI))


def test_search_limit_is_per_candidate_and_part_of_cache_key(sdk):
    metadata, transport = sdk
    a, b = table(NAME + "a"), table(NAME + "b")
    transport.entities = {item.fullyQualifiedName.root: item for item in (a, b)}
    transport.hits = list(transport.entities)
    resolver = EntityResolver(metadata)
    request = plan("my_service.*.*.*", WILDCARD, max_candidates_per_lookup=2)
    assert ids(resolver.resolve(request)) == [a.id, b.id]
    with pytest.raises(ValueError, match="limit"):
        resolver.resolve(replace(request, max_candidates_per_lookup=1))
    transport.hits = [NAME]
    transport.entities[NAME] = table()
    tier = ResolutionTier((FqnCandidate(NAME, CI), FqnCandidate(NAME, WILDCARD)))
    assert len(resolver.resolve(EntityResolutionPlan(Table, (tier,), max_candidates_per_lookup=1))) == 1


def test_fields_are_normalized_but_include_policies_do_not_share_cache(sdk):
    metadata, transport = sdk
    active = table()
    transport.entities[NAME] = active
    resolver = EntityResolver(metadata)
    request = plan(fields=("owners", "tags", "owners"))
    assert ids(resolver.resolve(request)) == [active.id]
    deleted = table(deleted=True)
    transport.entities[NAME] = deleted
    assert ids(resolver.resolve(replace(request, fields=("tags", "owners")))) == [active.id]
    assert ids(resolver.resolve(plan(include="deleted"))) == [deleted.id]
    assert ids(resolver.resolve(plan(include="all"))) == [deleted.id]
    assert resolver.resolve(plan()) == ()
    assert transport.requests[-2][1] == {"include": ["all"]}
    assert transport.requests[0][1] == {"fields": ["owners,tags"]}
    assert resolver.resolve(plan(fields=("description",))) == ()


@pytest.mark.parametrize("include", ["all", "deleted"])
def test_search_does_not_promise_deleted_entity_resolution(include):
    with pytest.raises(ValueError, match="active entities"):
        plan(mode=CI, include=include)


def test_lru_eviction_and_close_release_entities_and_preserve_borrowed_client(sdk):
    metadata, transport = sdk
    resolver = EntityResolver(metadata, cache_capacity=2)
    a, b, c = table(NAME + "a"), table(NAME + "b"), table(NAME + "c")
    transport.entities = {item.fullyQualifiedName.root: item for item in (a, b, c)}
    pa, pb, pc = (plan(item.fullyQualifiedName.root) for item in (a, b, c))
    a_result = resolver.resolve(pa)[0]
    ref = weakref.ref(a_result)
    resolver.resolve(pb)
    assert ids(resolver.resolve(pa)) == [a.id]
    resolver.resolve(pc)
    new_b = table(b.fullyQualifiedName.root)
    transport.entities[b.fullyQualifiedName.root] = new_b
    assert ids(resolver.resolve(pb)) == [new_b.id]
    del a_result
    gc.collect()
    assert ref() is None
    c_result = resolver.resolve(pc)[0]
    ref = weakref.ref(c_result)
    del c_result
    resolver.close()
    resolver.close()
    gc.collect()
    assert ref() is None
    with pytest.raises(RuntimeError, match="closed"):
        resolver.resolve(pa)
    assert not transport.closed
    assert metadata.get_by_name(Table, NAME + "c").id == c.id


def test_bounded_plan_rejects_excess_candidates(sdk):
    metadata, _ = sdk
    resolver = EntityResolver(metadata, max_plan_candidates=1)
    with pytest.raises(ValueError, match="Too many"):
        resolver.resolve(EntityResolutionPlan(Table, (ResolutionTier((FqnCandidate(NAME, EXACT),) * 2),)))


def test_concurrent_cache_reads_with_eviction_return_correct_ids(sdk):
    metadata, transport = sdk
    entities = [table(NAME + str(index)) for index in range(8)]
    transport.entities = {item.fullyQualifiedName.root: item for item in entities}
    resolver = EntityResolver(metadata, cache_capacity=2)
    barrier = Barrier(8)

    def resolve_repeatedly(entity):
        barrier.wait(timeout=10)
        for _ in range(50):
            assert ids(resolver.resolve(plan(entity.fullyQualifiedName.root))) == [entity.id]

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(resolve_repeatedly, entities))


def test_same_engine_resolves_a_non_table_entity(sdk):
    metadata, transport = sdk
    topic = Topic(
        id=uuid4(),
        name="my_topic",
        fullyQualifiedName="my_service.my_topic",
        partitions=1,
        service={"id": str(uuid4()), "type": "messagingService"},
    )
    transport.entities[topic.fullyQualifiedName.root] = topic
    request = EntityResolutionPlan(Topic, (ResolutionTier((FqnCandidate("my_service.my_topic", EXACT),)),))
    assert ids(EntityResolver(metadata).resolve(request)) == [topic.id]


@pytest.mark.parametrize(
    "raw,database,schema,name",
    [
        ("my_table", "my_db", "my_schema", NAME),
        ("my_schema.my_table", "my_db", "wrong_schema", NAME),
        ("my_db.my_schema.my_table", "wrong_db", None, NAME),
        ('"my.table"', "my_db", "my_schema", 'my_service.my_db.my_schema."my.table"'),
    ],
)
def test_table_facade_normalizes_identifiers(sdk, raw, database, schema, name):
    metadata, transport = sdk
    expected = table(name)
    transport.entities[name] = expected
    result = TableResolver(EntityResolver(metadata)).resolve(
        service_names=("my_service",),
        database_name=database,
        database_schema=schema,
        table_name=raw,
    )
    assert ids(result) == [expected.id]


def test_table_facade_service_priority_and_explicit_schema_fallback(sdk):
    metadata, transport = sdk
    fallback = table("first.my_db.other_schema.my_table")
    preferred = table("second.my_db.my_schema.my_table")
    transport.entities = {item.fullyQualifiedName.root: item for item in (fallback, preferred)}
    transport.hits = list(transport.entities)
    kwargs = {
        "service_names": ("first", "second"),
        "database_name": "my_db",
        "database_schema": "my_schema",
        "table_name": "my_table",
    }
    assert ids(TableResolver(EntityResolver(metadata)).resolve(**kwargs, schema_fallback=True)) == [preferred.id]
    del transport.entities[preferred.fullyQualifiedName.root]
    assert TableResolver(EntityResolver(metadata)).resolve(**kwargs) == ()
    assert ids(TableResolver(EntityResolver(metadata)).resolve(**kwargs, schema_fallback=True)) == [fallback.id]


def test_connector_bindings_preserve_priority_and_do_not_leak_normalization(sdk):
    metadata, transport = sdk
    clickhouse = table("first.catalog.my_schema.my_table")
    postgres = table("second.my_db.my_schema.my_table")
    wrong_database = table("second.other_db.my_schema.my_table")
    fallback = table("first.catalog.other_schema.my_table")
    transport.entities = {
        item.fullyQualifiedName.root: item for item in (clickhouse, postgres, wrong_database, fallback)
    }
    transport.hits = list(transport.entities)
    bindings = {"first": "Clickhouse", "second": "Postgres"}
    kwargs = {"database_name": "ignored", "database_schema": "ignored", "table_name": "my_db.my_schema.my_table"}

    def resolve():
        return TableResolver(EntityResolver(metadata), bindings).resolve(**kwargs, schema_fallback=True)

    assert ids(resolve()) == [clickhouse.id]
    del transport.entities[clickhouse.fullyQualifiedName.root]
    assert ids(resolve()) == [postgres.id]
    del transport.entities[postgres.fullyQualifiedName.root]
    assert ids(resolve()) == [fallback.id]


def test_unknown_service_type_uses_canonical_names_without_connector_normalization(sdk):
    metadata, transport = sdk
    expected, wrong = table("first.my_db.my_schema.my_table"), table("second.other_db.my_schema.my_table")
    transport.entities = {item.fullyQualifiedName.root: item for item in (expected, wrong)}
    transport.hits = list(transport.entities)
    facade = TableResolver(EntityResolver(metadata), {})
    assert ids(facade.resolve(database_name="my_db", database_schema="my_schema", table_name="my_table")) == [
        expected.id
    ]


def test_table_facade_wildcard_service_unions_matches(sdk):
    metadata, transport = sdk
    a, b = table("first.my_db.my_schema.my_table"), table("second.my_db.my_schema.my_table")
    transport.entities = {item.fullyQualifiedName.root: item for item in (a, b)}
    transport.hits = list(transport.entities)
    facade = TableResolver(EntityResolver(metadata))
    kwargs = {"database_name": "my_db", "database_schema": "my_schema", "table_name": "my_table"}
    assert ids(facade.resolve(service_names=("*",), **kwargs)) == [a.id, b.id]
    with pytest.raises(ValueError, match="cannot be mixed"):
        facade.resolve(service_names=("*", "first"), **kwargs)


def test_tier_failure_does_not_cache_partial_success_or_try_lower_tier(sdk):
    metadata, transport = sdk
    entity = table()
    transport.entities[NAME] = entity
    transport.hits = [NAME] * 11
    request = EntityResolutionPlan(
        Table,
        (
            ResolutionTier((FqnCandidate(NAME, EXACT), FqnCandidate(NAME, CI))),
            ResolutionTier((FqnCandidate(NAME, EXACT),)),
        ),
    )
    resolver = EntityResolver(metadata)
    with pytest.raises(ValueError, match="limit"):
        resolver.resolve(request)
    recreated = table()
    transport.entities[NAME] = recreated
    transport.hits = [NAME]
    assert ids(resolver.resolve(request)) == [recreated.id]


def test_hydration_rejects_a_renamed_entity(sdk):
    metadata, transport = sdk
    transport.entities[NAME] = table(NAME + "_renamed")
    transport.hits = [NAME]
    assert EntityResolver(metadata).resolve(plan(mode=CI)) == ()


@pytest.mark.parametrize("response", [None, "not JSON"])
def test_invalid_search_response_is_an_error_not_a_miss(sdk, monkeypatch, response):
    metadata, transport = sdk
    monkeypatch.setattr(transport, "get", lambda path: response)
    with pytest.raises(TypeError, match="Invalid FQN search response"):
        EntityResolver(metadata).resolve(plan(mode=CI))


def bigquery_family(name="events_yyyymmdd"):
    return table(
        f"my_service.my_db.my_schema.{name}",
        tableType="Sharded",
        tableSharding=TableSharding(
            prefix="events_",
            suffixFormat="YYYYMMDD",
            shardCount=2,
            firstShardDate="2026-01-01",
            lastShardDate="2026-01-02",
            representative={
                "databaseName": "my_db",
                "schemaName": "my_schema",
                "tableName": "events_20260102",
                "shardDate": "2026-01-02",
            },
        ),
    )


def resolve_bigquery(metadata, name):
    return TableResolver(EntityResolver(metadata), {"my_service": "BigQuery"}).resolve(
        database_name="my_db", database_schema="my_schema", table_name=name
    )


def test_bigquery_concrete_precedence_and_decorator(sdk):
    metadata, transport = sdk
    family = bigquery_family()
    transport.entities[family.fullyQualifiedName.root] = family
    assert ids(resolve_bigquery(metadata, "events_20260101$20260102")) == [family.id]
    physical = table("my_service.my_db.my_schema.events_20260101")
    transport.entities[physical.fullyQualifiedName.root] = physical
    assert ids(resolve_bigquery(metadata, "events_20260101")) == [physical.id]
    physical.deleted = True
    assert ids(resolve_bigquery(metadata, "events_20260101")) == [family.id]


def test_bigquery_placeholder_without_descriptor_is_not_a_family(sdk):
    metadata, transport = sdk
    ordinary = table("my_service.my_db.my_schema.events_yyyymmdd")
    transport.entities[ordinary.fullyQualifiedName.root] = ordinary
    assert resolve_bigquery(metadata, "events_20260101") == ()


@pytest.mark.parametrize("count", [11, 100, 101])
def test_bigquery_wildcard_is_complete_or_fails(sdk, count):
    metadata, transport = sdk
    tables = [table(f"my_service.my_db.my_schema.events_{index}") for index in range(count)]
    transport.entities = {value.fullyQualifiedName.root: value for value in tables}
    transport.hits = list(transport.entities)
    if count > 100:
        with pytest.raises(ValueError, match="configured limit"):
            resolve_bigquery(metadata, "events_*")
    else:
        assert len(resolve_bigquery(metadata, "events_*")) == count


def test_bigquery_date_wildcard_does_not_invent_membership(sdk):
    with pytest.raises(ValueError, match="member inventory evidence"):
        resolve_bigquery(sdk[0], "events_2026*")


def add_bigquery_service(transport):
    transport.entities["my_service"] = DatabaseService(
        id=uuid4(),
        name="my_service",
        serviceType="BigQuery",
        connection={"config": {"type": "BigQuery", "credentials": {"gcpConfig": {}}}},
    )


def test_bigquery_usage_counts_each_execution_once_and_preserves_sql(sdk, tmp_path):
    metadata, transport = sdk
    add_bigquery_service(transport)
    family = bigquery_family()
    transport.entities[family.fullyQualifiedName.root] = family
    stage = TableUsageStage(TableStageConfig(filename=str(tmp_path / "usage")), metadata)
    execution = ParsedData(
        tables=["my_db.my_schema.events_20260101", "my_db.my_schema.events_20260102"],
        databaseName="my_db",
        databaseSchema="my_schema",
        serviceName="my_service",
        joins={},
        date="1767398400000",
        sql="SELECT * FROM events_20260101 JOIN events_20260102 USING(id)",
    )
    outcomes = list(stage._run(QueryParserData(parsedData=[execution, execution])))
    assert len(outcomes) == 2
    assert all(outcome.left is None and outcome.right == "my_db.my_schema.events_yyyymmdd" for outcome in outcomes)
    values = list(stage.table_usage.values())
    assert len(values) == 1
    assert values[0].table == "my_db.my_schema.events_yyyymmdd"
    assert values[0].count == 2
    assert [item.query.root for item in values[0].sqlQueries] == [execution.sql, execution.sql]


@pytest.mark.parametrize("count", [11, 100, 101])
def test_hex_sql_cells_expand_complete_bigquery_wildcards(sdk, count):
    metadata, transport = sdk
    add_bigquery_service(transport)
    tables = [table(f"my_service.my_db.my_schema.events_{index}") for index in range(count)]
    transport.entities.update({value.fullyQualifiedName.root: value for value in tables})
    transport.hits = [value.fullyQualifiedName.root for value in tables]
    source = HexSource.__new__(HexSource)
    source.metadata = metadata
    source.source_config = SimpleNamespace(lineageInformation=SimpleNamespace(dbServicePrefixes=["my_service"]))
    cell = Cell(
        id="cell",
        dataConnectionId="connection",
        contents={"sqlCell": {"source": "SELECT id FROM `my_db.my_schema.events_*`"}},
    )
    connections = {"connection": DataConnection(id="connection", name="demo", type="bigquery")}
    if count > 100:
        with pytest.raises(TableSearchError, match="configured limit"):
            source._build_sql_cell_lineage(cell, connections, ChainedCells(), LRUCache(100))
    else:
        result = source._build_sql_cell_lineage(cell, connections, ChainedCells(), LRUCache(100))
        assert set(result.tables) == {str(value.id.root) for value in tables}
        assert all(not column.source_columns for column in result.columns)


@pytest.mark.parametrize("count", [11, 100, 101])
def test_hex_warehouse_queries_expand_or_report_incomplete(sdk, count, caplog):
    metadata, transport = sdk
    add_bigquery_service(transport)
    tables = [table(f"my_service.my_db.my_schema.events_{index}") for index in range(count)]
    transport.entities.update({value.fullyQualifiedName.root: value for value in tables})
    transport.hits = [value.fullyQualifiedName.root for value in tables]
    result = HexQueryFetcher(metadata)._extract_tables_from_query(
        "SELECT * FROM `my_db.my_schema.events_*`", "my_service", "my_db", "my_schema", "my_service"
    )
    if count > 100:
        assert result == []
        assert "incomplete" in caplog.text
    else:
        assert {value.id.root for value in result} == {value.id.root for value in tables}


@pytest.mark.parametrize("count", [11, 100, 101])
def test_dbt_wildcards_emit_all_edges_or_preserve_previous_scope(sdk, count):
    metadata, transport = sdk
    add_bigquery_service(transport)
    matches = [table(f"my_service.my_db.my_schema.events_{index}") for index in range(count)]
    transport.entities.update({value.fullyQualifiedName.root: value for value in matches})
    transport.hits = [value.fullyQualifiedName.root for value in matches]
    source = DbtSource.__new__(DbtSource)
    source.metadata = metadata
    source.source_config = SimpleNamespace(overrideLineage=True)
    source.status = MagicMock()
    target = table("my_service.my_db.my_schema.summary")
    link = DataModelLink(
        table_entity=target, datamodel=DataModel(modelType="DBT", upstream=["my_service.my_db.my_schema.events_*"])
    )
    outcomes = list(source.create_dbt_lineage(link))
    if count > 100:
        assert outcomes == []
        assert source.status.warning.call_args[0][1].startswith("dbt lineage incomplete")
    else:
        assert {outcome.right.lineage_request.edge.fromEntity.id.root for outcome in outcomes} == {
            value.id.root for value in matches
        }
        assert all(outcome.right.lineage_request.edge.toEntity.id == target.id for outcome in outcomes)


@pytest.mark.parametrize("count", [11, 100, 101])
def test_looker_wildcard_lineage_is_complete_without_guessed_columns(sdk, count):
    from metadata.generated.schema.entity.data.dashboard import Dashboard
    from metadata.ingestion.source.dashboard.looker.metadata import LookerSource

    metadata, transport = sdk
    add_bigquery_service(transport)
    matches = [table(f"my_service.my_db.my_schema.events_{index}") for index in range(count)]
    transport.entities.update({value.fullyQualifiedName.root: value for value in matches})
    transport.hits = [value.fullyQualifiedName.root for value in matches]
    source = LookerSource.__new__(LookerSource)
    source.metadata = metadata
    source._added_lineage = {}
    target = Dashboard(id=uuid4(), name="demo_dashboard", service={"id": uuid4(), "type": "dashboardService"})
    requests = source.build_lineage_requests("my_db.my_schema.events_*", "my_service", target, [("id", "id")])
    if count > 100:
        with pytest.raises(ValueError, match="configured limit"):
            list(requests)
        assert source._added_lineage == {}
    else:
        edges = [outcome.right.edge for outcome in requests]
        assert {edge.fromEntity.id.root for edge in edges} == {value.id.root for value in matches}
        assert all(edge.toEntity.id == target.id and not edge.lineageDetails.columnsLineage for edge in edges)


def test_custom_resolution_preserves_service_and_schema_precedence(sdk):
    metadata, transport = sdk
    family = bigquery_family()
    fallback = table(
        "my_service.my_db.other_schema.events_yyyymmdd",
        tableType="Sharded",
        tableSharding=family.tableSharding.model_copy(
            update={
                "representative": family.tableSharding.representative.model_copy(update={"schemaName": "other_schema"}),
            }
        ),
    )
    ordinary = table("second.my_db.my_schema.events_20260101")
    transport.entities = {fallback.fullyQualifiedName.root: fallback, ordinary.fullyQualifiedName.root: ordinary}
    transport.hits = list(transport.entities)
    bindings = {"my_service": "BigQuery", "second": "Postgres"}
    kwargs = {"database_name": "my_db", "database_schema": "my_schema", "table_name": "events_20260101"}

    def resolve(**options):
        return TableResolver(EntityResolver(metadata), bindings).resolve(**kwargs, **options)

    assert ids(resolve(schema_fallback=True)) == [ordinary.id]
    del transport.entities[ordinary.fullyQualifiedName.root]
    assert resolve() == ()
    assert ids(resolve(schema_fallback=True)) == [fallback.id]
    transport.entities[family.fullyQualifiedName.root] = family
    assert ids(resolve(schema_fallback=True)) == [family.id]


def test_unknown_service_type_does_not_apply_connector_resolution(sdk):
    metadata, transport = sdk
    family = bigquery_family()
    ordinary = table("second.my_db.my_schema.events_20260101")
    transport.entities = {value.fullyQualifiedName.root: value for value in (family, ordinary)}
    transport.hits = list(transport.entities)
    facade = TableResolver(EntityResolver(metadata), {})
    result = facade.resolve(database_name="my_db", database_schema="my_schema", table_name="events_20260101")
    assert ids(result) == [ordinary.id]


def test_lineage_service_priority_keeps_resolution_policy_scoped(sdk):
    metadata, transport = sdk
    add_bigquery_service(transport)
    transport.entities["ordinary_service"] = DatabaseService(
        id=uuid4(),
        name="ordinary_service",
        serviceType="Postgres",
    )
    family = bigquery_family()
    ordinary = table("ordinary_service.my_db.my_schema.events_20260101")
    transport.entities.update({value.fullyQualifiedName.root: value for value in (family, ordinary)})
    assert ids(
        search_table_entities(metadata, ["my_service", "ordinary_service"], "my_db", "my_schema", "events_20260101")
    ) == [family.id]
    assert ids(
        search_table_entities(metadata, ["ordinary_service", "my_service"], "my_db", "my_schema", "events_20260101")
    ) == [ordinary.id]
    assert search_table_entities(metadata, "ordinary_service", "my_db", "my_schema", "events_20260102") is None


def test_usage_without_resolution_policy_preserves_physical_names(sdk, tmp_path):
    metadata, transport = sdk
    transport.entities["ordinary_usage_service"] = DatabaseService(
        id=uuid4(),
        name="ordinary_usage_service",
        serviceType="Postgres",
    )
    stage = TableUsageStage(TableStageConfig(filename=str(tmp_path / "usage")), metadata)
    execution = ParsedData(
        tables=["my_db.my_schema.events_20260101", "my_db.my_schema.events_20260102"],
        databaseName="my_db",
        databaseSchema="my_schema",
        serviceName="ordinary_usage_service",
        joins={},
        date="1767398400000",
        sql="SELECT 1",
    )
    outcomes = list(stage._run(QueryParserData(parsedData=[execution])))
    assert [outcome.right for outcome in outcomes] == execution.tables
    assert {value.table: value.count for value in stage.table_usage.values()} == {
        "my_db.my_schema.events_20260101": 1,
        "my_db.my_schema.events_20260102": 1,
    }


@pytest.mark.parametrize("source_type", [None, "Postgres", "not_installed"])
def test_default_resolution_searches_across_services_only_when_service_is_unknown(sdk, source_type):
    from metadata.domain.table_reference import TableReference
    from metadata.utils.service_spec.service_spec import load_table_binding_resolution

    metadata, transport = sdk
    candidate = table("other.my_db.my_schema.my_table")
    transport.hits = [candidate.fullyQualifiedName.root]
    transport.entities[candidate.fullyQualifiedName.root] = candidate
    resolution = load_table_binding_resolution(source_type, metadata)
    reference = TableReference("my_db", "my_schema", "my_table")
    assert resolution.resolve(reference) == (candidate,)
    transport.requests.clear()
    assert resolution.resolve(reference, service_name="missing") == ()
    assert all("*." not in params.get("fieldValue", [""])[0] for _, params in transport.requests)


def test_source_loader_override_controls_resolution_without_changing_callers(sdk):
    from metadata.domain.table_reference import TableReference
    from metadata.utils.dependency_injector.dependency_injector import DependencyContainer
    from metadata.utils.service_spec.service_spec import BaseSpec, SourceLoader, load_table_binding_resolution

    metadata, transport = sdk
    family = bigquery_family()
    transport.entities[family.fullyQualifiedName.root] = family
    container = DependencyContainer()
    container.override(
        SourceLoader,
        lambda: (
            lambda *args: BaseSpec(
                metadata_source_class="custom.metadata.Source",
                table_binding_resolution_class="metadata.ingestion.source.database.bigquery.resolution.BigQueryTableBindingResolution",
            )
        ),
    )
    try:
        resolution = load_table_binding_resolution("custom", metadata)
        assert resolution.resolve(
            TableReference("my_db", "my_schema", "events_20260101"), service_name="my_service"
        ) == (family,)
    finally:
        container.remove_override(SourceLoader)


def test_service_type_cache_is_isolated_between_catalogs(sdk):
    from metadata.ingestion.lineage.sql_lineage import get_table_binding_resolution

    metadata, transport = sdk
    add_bigquery_service(transport)
    assert type(get_table_binding_resolution(metadata, "my_service")).__name__ == "BigQueryTableBindingResolution"
    second = OpenMetadata(metadata.config)
    second.client = Transport()
    second.client.entities["my_service"] = DatabaseService(id=uuid4(), name="my_service", serviceType="Postgres")
    assert type(get_table_binding_resolution(second, "my_service")).__name__ == "TableBindingResolution"


def test_ordinary_usage_keeps_names_and_counts_without_table_lookups(sdk, tmp_path):
    metadata, transport = sdk
    transport.entities["my_service"] = DatabaseService(id=uuid4(), name="my_service", serviceType="Postgres")
    stage = TableUsageStage(TableStageConfig(filename=str(tmp_path / "usage")), metadata)
    execution = ParsedData(
        tables=["my_db.my_schema.my_table"],
        databaseName="my_db",
        databaseSchema="my_schema",
        serviceName="my_service",
        joins={},
        date="1767398400000",
        sql="SELECT * FROM my_table",
    )
    outcomes = list(stage._run(QueryParserData(parsedData=[execution, execution])))
    assert [item.right for item in outcomes] == ["my_db.my_schema.my_table"] * 2
    assert next(iter(stage.table_usage.values())).count == 2
    assert all("/tables/" not in path for path, _ in transport.requests)


@pytest.mark.parametrize("services", [None, []])
def test_sql_lineage_without_service_context_searches_across_services(sdk, services):
    metadata, transport = sdk
    candidate = table("other.my_db.my_schema.my_table")
    transport.entities[candidate.fullyQualifiedName.root] = candidate
    transport.hits = [candidate.fullyQualifiedName.root]
    assert search_table_entities(metadata, services, "my_db", "my_schema", "my_table") == [candidate]


def test_dbt_family_resolution_requests_source_hash(sdk):
    metadata, transport = sdk
    add_bigquery_service(transport)
    family = bigquery_family()
    family.sourceHash = "existing_hash"
    transport.entities[family.fullyQualifiedName.root] = family
    source = DbtSource.__new__(DbtSource)
    source.metadata = metadata
    source.status = MagicMock()
    assert source._search_table("my_service.my_db.my_schema.events_20260101").sourceHash == "existing_hash"
    table_requests = [(path, params) for path, params in transport.requests if path.startswith("/tables/")]
    assert table_requests[-1][1]["fields"] == ["sourceHash"]
