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
"""Search lookups that tell query lineage which processed queries are still intact."""

import json
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.mixins.es_mixin import SEARCH_TERMS_BATCH_SIZE, ESMixin

SERVER_MAX_REQUEST_HEADER_BYTES = 8 * 1024


def _hit(doc_id, source):
    return {"_index": "index", "_id": doc_id, "_source": source}


class RecordingSearchClient:
    """Stands in for the REST client: answers each search with the hits whose id or
    checksum the request's filter names, and records every request it receives."""

    def __init__(self, hits=(), fail=False):
        self._hits = list(hits)
        self._fail = fail
        self.paths = []

    def get(self, path):
        self.paths.append(path)
        if self._fail:
            raise ConnectionError("search is unavailable")
        requested = _requested_values(json.loads(parse_qs(urlsplit(path).query)["query_filter"][0])["query"])
        hits = [hit for hit in self._hits if requested & {hit["_id"], hit["_source"].get("checksum")}]
        return {"hits": {"total": {"relation": "eq", "value": len(hits)}, "hits": hits}}

    @property
    def sizes(self):
        return [int(parse_qs(urlsplit(path).query)["size"][0]) for path in self.paths]


def _requested_values(query):
    if "ids" in query:
        return set(query["ids"]["values"])
    (terms,) = [clause["terms"] for clause in query["bool"]["must"] if "terms" in clause]
    return set(terms["checksum.keyword"])


def _mixin(client):
    mixin = ESMixin()
    mixin.client = client
    return mixin


class TestLineageProcessedQueries:
    def test_maps_each_processed_query_to_the_tables_it_is_used_in(self):
        client = RecordingSearchClient(
            [
                _hit("q1", {"checksum": "c1", "queryUsedIn": [{"id": "t1", "type": "table"}, {"id": "t2"}]}),
                _hit("q2", {"checksum": "c2"}),
            ]
        )

        processed = _mixin(client).es_get_lineage_processed_queries("svc", ["c1", "c2", "c3"])

        assert processed == {"c1": {"t1", "t2"}, "c2": set()}

    def test_large_lookups_are_split_into_requests_the_server_accepts(self):
        checksums = [f"{i:032x}" for i in range(SEARCH_TERMS_BATCH_SIZE * 2 + 1)]
        client = RecordingSearchClient([_hit(str(i), {"checksum": checksum}) for i, checksum in enumerate(checksums)])

        processed = _mixin(client).es_get_lineage_processed_queries("svc", checksums)

        assert set(processed) == set(checksums)
        assert client.sizes == [SEARCH_TERMS_BATCH_SIZE, SEARCH_TERMS_BATCH_SIZE, 1]
        assert max(len(path) for path in client.paths) < SERVER_MAX_REQUEST_HEADER_BYTES

    def test_failed_lookup_reports_no_processed_queries(self):
        assert _mixin(RecordingSearchClient(fail=True)).es_get_lineage_processed_queries("svc", ["c1"]) == {}


class TestUpstreamEntityIds:
    def test_maps_each_indexed_table_to_its_upstream_sources(self):
        target_id, source_id, other_source_id, missing_id = (str(uuid4()) for _ in range(4))
        client = RecordingSearchClient(
            [
                _hit(
                    target_id,
                    {
                        "id": target_id,
                        "upstreamLineage": [{"fromEntity": {"id": source_id}}, {"fromEntity": {"id": other_source_id}}],
                    },
                ),
                _hit(source_id, {"id": source_id}),
            ]
        )

        upstreams = _mixin(client).es_get_upstream_entity_ids(Table, [target_id, source_id, missing_id])

        assert upstreams == {target_id: {source_id, other_source_id}, source_id: set()}

    def test_large_lookups_are_split_into_requests_the_server_accepts(self):
        ids = [str(uuid4()) for _ in range(SEARCH_TERMS_BATCH_SIZE + 1)]
        client = RecordingSearchClient([_hit(entity_id, {"id": entity_id}) for entity_id in ids])

        assert set(_mixin(client).es_get_upstream_entity_ids(Table, ids)) == set(ids)
        assert client.sizes == [SEARCH_TERMS_BATCH_SIZE, 1]
        assert max(len(path) for path in client.paths) < SERVER_MAX_REQUEST_HEADER_BYTES

    def test_no_ids_sends_no_request(self):
        client = RecordingSearchClient()

        assert _mixin(client).es_get_upstream_entity_ids(Table, []) == {}
        assert client.paths == []

    def test_failed_lookup_reports_no_indexed_tables(self):
        assert _mixin(RecordingSearchClient(fail=True)).es_get_upstream_entity_ids(Table, [str(uuid4())]) == {}
