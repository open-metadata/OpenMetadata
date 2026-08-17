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
Tests for the paginated Unity Catalog listing helpers.

Unity Catalog answers an unpaginated list request on a large metastore with
``InvalidParameterValue ... #UC-PGRQD`` instead of results, so the catalog listing has
to ask for a bounded page and follow ``next_page_token`` to the end.
"""

from unittest.mock import MagicMock

from metadata.ingestion.source.database.unitycatalog.listing import (
    CATALOGS_API_PATH,
    SERVER_PAGE_SIZE,
    list_catalogs,
)


def _client(*pages) -> MagicMock:
    client = MagicMock()
    client.api_client.do.side_effect = list(pages)
    return client


class TestListCatalogs:
    def test_requests_a_server_sized_page_instead_of_the_whole_result_set(self):
        client = _client({"catalogs": [{"name": "main"}]})

        assert [catalog.name for catalog in list_catalogs(client)] == ["main"]

        client.api_client.do.assert_called_once_with(
            "GET",
            CATALOGS_API_PATH,
            query={"max_results": SERVER_PAGE_SIZE},
            headers={"Accept": "application/json"},
        )

    def test_follows_next_page_token_across_pages(self):
        client = _client(
            {"catalogs": [{"name": "a"}], "next_page_token": "t1"},
            {"catalogs": [{"name": "b"}], "next_page_token": "t2"},
            {"catalogs": [{"name": "c"}]},
        )

        assert [catalog.name for catalog in list_catalogs(client)] == ["a", "b", "c"]

        sent_tokens = [call.kwargs["query"].get("page_token") for call in client.api_client.do.call_args_list]
        assert sent_tokens == [None, "t1", "t2"]

    def test_empty_page_with_a_token_does_not_end_the_listing(self):
        """Unity Catalog may return a page with no catalogs while more remain; only a
        missing token means the listing is exhausted."""
        client = _client(
            {"catalogs": [], "next_page_token": "t1"},
            {"next_page_token": "t2"},
            {"catalogs": [{"name": "late"}]},
        )

        assert [catalog.name for catalog in list_catalogs(client)] == ["late"]
        assert client.api_client.do.call_count == 3

    def test_repeated_token_stops_instead_of_paging_forever(self):
        client = _client(
            {"catalogs": [{"name": "a"}], "next_page_token": "same"},
            {"catalogs": [{"name": "b"}], "next_page_token": "same"},
        )

        assert [catalog.name for catalog in list_catalogs(client)] == ["a", "b"]
        assert client.api_client.do.call_count == 2

    def test_pages_are_yielded_lazily(self):
        """A caller that only needs the first catalog must not pay for the whole walk."""
        client = _client(
            {"catalogs": [{"name": "first"}], "next_page_token": "t1"},
            {"catalogs": [{"name": "second"}]},
        )

        assert next(list_catalogs(client)).name == "first"
        assert client.api_client.do.call_count == 1
