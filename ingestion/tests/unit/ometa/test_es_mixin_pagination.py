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
"""search_after pagination over the search API."""

from urllib.parse import parse_qs, urlsplit

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.mixins.es_mixin import ESMixin, SearchCursorStalledError


def _page(*sorts):
    hits = [{"_index": "table_search_index", "_id": str(sort), "_source": {}, "sort": sort} for sort in sorts]
    return {"hits": {"total": {"relation": "eq", "value": len(hits)}, "hits": hits}}


class PagedSearchClient:
    """Answers the n-th search request with the n-th page, repeating the last one."""

    def __init__(self, pages):
        self._pages = pages
        self.cursors = []

    def get(self, path):
        self.cursors.append(parse_qs(urlsplit(path).query).get("search_after"))
        return self._pages[min(len(self.cursors), len(self._pages)) - 1]


def _paginate(pages):
    client = PagedSearchClient(pages)
    mixin = ESMixin()
    mixin.client = client
    return list(mixin._paginate_es_internal(entity=Table)), client


def test_pagination_follows_a_cursor_that_advances():
    responses, client = _paginate([_page(["b", "b", "id-b"]), _page(["a", "a", "id-a"]), _page()])

    assert [hit.id for response in responses for hit in response.hits.hits] == [
        "['b', 'b', 'id-b']",
        "['a', 'a', 'id-a']",
    ]
    assert client.cursors == [None, ["b", "b", "id-b"], ["a", "a", "id-a"]]


def test_pagination_raises_when_the_cursor_does_not_advance():
    # A hit whose index cannot sort on the id tiebreaker comes back with a null sort value, and
    # search_after cannot move past it: the server answers every request with the same page.
    # Stopping quietly would report a partial walk as a complete one.
    client = PagedSearchClient([_page(["p", "p", None])])
    mixin = ESMixin()
    mixin.client = client
    responses = []

    with pytest.raises(SearchCursorStalledError, match=r"table_search_index .* Reindex it"):
        for response in mixin._paginate_es_internal(entity=Table):
            responses.append(response)
            assert len(client.cursors) <= 3, "the guard must stop the loop"

    assert len(responses) == 1
    assert len(client.cursors) == 2
