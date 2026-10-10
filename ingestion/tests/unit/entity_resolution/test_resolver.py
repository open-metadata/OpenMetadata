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
from metadata.entity_resolution.table import TableResolver, TableServiceBinding
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.data.topic import Topic
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.clickhouse.naming import normalize_table_reference as clickhouse_reference

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
    bindings = (TableServiceBinding("first", clickhouse_reference), TableServiceBinding("second"))
    kwargs = {"database_name": "ignored", "database_schema": "ignored", "table_name": "my_db.my_schema.my_table"}

    def resolve():
        return TableResolver(EntityResolver(metadata), bindings).resolve(**kwargs, schema_fallback=True)

    assert ids(resolve()) == [clickhouse.id]
    del transport.entities[clickhouse.fullyQualifiedName.root]
    assert ids(resolve()) == [postgres.id]
    del transport.entities[postgres.fullyQualifiedName.root]
    assert ids(resolve()) == [fallback.id]


def test_wildcard_service_uses_canonical_names_without_connector_normalization(sdk):
    metadata, transport = sdk
    expected, wrong = table("first.my_db.my_schema.my_table"), table("second.other_db.my_schema.my_table")
    transport.entities = {item.fullyQualifiedName.root: item for item in (expected, wrong)}
    transport.hits = list(transport.entities)
    facade = TableResolver(EntityResolver(metadata), (TableServiceBinding("*", clickhouse_reference),))
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
