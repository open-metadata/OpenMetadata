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
"""Unit tests for the Solr HTTP client."""

from unittest.mock import MagicMock

from metadata.ingestion.source.search.solr.client import SolrClient


def _client() -> SolrClient:
    client = SolrClient(base_url="http://localhost:8983/solr/")
    client.session = MagicMock()
    return client


def _response(payload: dict):
    response = MagicMock()
    response.json.return_value = payload
    return response


def test_base_url_trailing_slash_is_stripped():
    client = SolrClient(base_url="http://localhost:8983/solr/")
    assert client.base_url == "http://localhost:8983/solr"


def test_list_collections_uses_collections_api():
    client = _client()
    client.session.get.return_value = _response({"collections": ["books", "films"]})

    assert client.list_collections() == ["books", "films"]
    url = client.session.get.call_args[0][0]
    assert url.endswith("/admin/collections")


def test_list_collections_falls_back_to_cores_for_standalone():
    client = _client()
    client.session.get.side_effect = [
        _response({"responseHeader": {"status": 0}}),  # no "collections" key
        _response({"status": {"core1": {}, "core2": {}}}),
    ]

    assert client.list_collections() == ["core1", "core2"]
    last_url = client.session.get.call_args[0][0]
    assert last_url.endswith("/admin/cores")


def test_get_schema_returns_schema_section():
    client = _client()
    client.session.get.return_value = _response({"schema": {"fields": [{"name": "id"}]}})

    assert client.get_schema("books") == {"fields": [{"name": "id"}]}


def test_get_sample_documents_returns_docs():
    client = _client()
    client.session.get.return_value = _response({"response": {"docs": [{"id": "1"}, {"id": "2"}]}})

    assert client.get_sample_documents("books", size=2) == [{"id": "1"}, {"id": "2"}]
