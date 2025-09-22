"""Search API with fluent interface."""
from __future__ import annotations

import asyncio
from functools import partial
from typing import (
    Any,
    Callable,
    ClassVar,
    List,
    Mapping,
    Optional,
    Protocol,
    TypeVar,
    Union,
    cast,
    runtime_checkable,
)
from urllib.parse import urlencode

from requests import Response

from ..client import OpenMetadata
from ..types import JsonDict, OMetaClient

T = TypeVar("T")
R = TypeVar("R")

SearchCallback = Callable[..., JsonDict]
SuggestCallback = Callable[..., List[str]]
AggregateCallback = Callable[..., JsonDict]
ReindexCallback = Callable[..., JsonDict]
ReindexAllCallback = Callable[..., JsonDict]


async def _run_async(function: Callable[..., R], *args: object, **kwargs: object) -> R:
    """Execute a blocking callable on the default executor."""
    loop = asyncio.get_running_loop()
    func = partial(function, *args, **kwargs)
    return await loop.run_in_executor(None, func)


def _encode_params(params: Mapping[str, Any]) -> str:
    """Utility to encode query parameters, skipping ``None`` values."""
    filtered = {key: value for key, value in params.items() if value is not None}
    return urlencode(filtered, doseq=True)


RestReturn = Union[JsonDict, Response, None]


@runtime_checkable
class RestClientProtocol(Protocol):
    """Structural protocol describing the REST client behaviour we use."""

    def get(self, path: str, data: Mapping[str, Any] | None = None) -> RestReturn:
        ...

    def post(
        self,
        path: str,
        data: Mapping[str, Any] | None = None,
        json: JsonDict | None = None,
    ) -> RestReturn:
        ...


def _http_get(client: OMetaClient, path: str, params: Mapping[str, Any]) -> JsonDict:
    query = _encode_params(params)
    resource = f"{path}?{query}" if query else path
    response = getattr(client, "client", None)
    if not isinstance(response, RestClientProtocol):
        raise RuntimeError("OpenMetadata client does not expose a REST client")
    rest_client: RestClientProtocol = response
    payload = rest_client.get(resource)
    if isinstance(payload, Response):
        if not payload.text:
            return {}
        parsed = payload.json()
        if not isinstance(parsed, Mapping):
            raise TypeError("Expected JSON response body to be a mapping")
        typed_parsed = cast(Mapping[str, Any], parsed)
        return dict(typed_parsed)
    if payload is None:
        return {}
    return payload


def _http_post(client: OMetaClient, path: str, body: JsonDict) -> JsonDict:
    response = getattr(client, "client", None)
    if not isinstance(response, RestClientProtocol):
        raise RuntimeError("OpenMetadata client does not expose a REST client")
    rest_client: RestClientProtocol = response
    payload = rest_client.post(path, json=body)
    if isinstance(payload, Response):
        if not payload.text:
            return {}
        parsed = payload.json()
        if not isinstance(parsed, Mapping):
            raise TypeError("Expected JSON response body to be a mapping")
        typed_parsed = cast(Mapping[str, Any], parsed)
        return dict(typed_parsed)
    if payload is None:
        return {}
    return payload


class Search:
    """Static fluent API for search operations."""

    _default_client: ClassVar[Optional[OMetaClient]] = None

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMetaClient]) -> None:
        """Set the default client for static methods."""
        cls._default_client = (
            client.ometa if isinstance(client, OpenMetadata) else client
        )

    @classmethod
    def _get_client(cls) -> OMetaClient:
        """Return the active OpenMetadata client."""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def search(  # pylint: disable=too-many-arguments
        cls,
        query: str,
        index: Optional[str] = None,
        from_: int = 0,
        size: int = 10,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        filters: Optional[Mapping[str, Any]] = None,
    ) -> JsonDict:
        """Perform a search query."""
        client = cls._get_client()
        params: JsonDict = {
            "query_string": query,
            "index": index,
            "from": from_,
            "size": size,
            "sort_field": sort_field,
            "sort_order": sort_order,
        }
        if filters:
            params.update(filters)

        search_fn_raw = getattr(client, "es_search_from_es", None)
        if callable(search_fn_raw):
            search_callback: SearchCallback = cast(SearchCallback, search_fn_raw)
            return search_callback(**params)  # pylint: disable=not-callable

        http_params = {
            "q": query,
            "from": from_,
            "size": size,
            "index": index,
            "sort_field": sort_field,
            "sort_order": sort_order,
        }
        if filters:
            http_params.update(filters)
        return _http_get(client, "/search/query", http_params)

    @classmethod
    def suggest(
        cls,
        query: str,
        field: Optional[str] = None,
        size: int = 5,
    ) -> List[str]:
        """Fetch entity suggestions."""
        client = cls._get_client()
        suggest_fn_raw = getattr(client, "get_suggest_entities", None)
        if callable(suggest_fn_raw):
            suggest_callback: SuggestCallback = cast(SuggestCallback, suggest_fn_raw)
            return suggest_callback(  # pylint: disable=not-callable
                query_string=query, field=field, size=size
            )

        http_params = {
            "q": query,
            "field": field,
            "size": size,
        }
        response = _http_get(client, "/search/aggregate", http_params)
        buckets = response.get("aggregations", {}).get("suggest", {}).get("buckets", [])
        return [str(bucket.get("key")) for bucket in buckets if bucket.get("key")]

    @classmethod
    def aggregate(
        cls,
        query: str,
        index: Optional[str] = None,
        field: Optional[str] = None,
    ) -> JsonDict:
        """Perform aggregation query."""
        client = cls._get_client()
        aggregate_fn_raw = getattr(client, "es_aggregate", None)
        params = {
            "query": query,
            "index": index,
            "field": field,
        }
        if callable(aggregate_fn_raw):
            aggregate_callback: AggregateCallback = cast(
                AggregateCallback, aggregate_fn_raw
            )
            return aggregate_callback(**params)  # pylint: disable=not-callable

        body: JsonDict = {
            "query": query,
            "index": index or "table_search_index",
            "fieldName": field,
        }
        return _http_post(client, "/search/aggregate", body)

    @classmethod
    def search_advanced(cls, search_request: JsonDict) -> JsonDict:
        """Perform advanced search with custom request body."""
        client = cls._get_client()
        search_fn_raw = getattr(client, "es_search_from_es", None)
        if callable(search_fn_raw):
            search_callback: SearchCallback = cast(SearchCallback, search_fn_raw)
            return search_callback(body=search_request)  # pylint: disable=not-callable
        return _http_post(client, "/search/query", search_request)

    @classmethod
    def reindex(cls, entity_type: str) -> JsonDict:
        """Trigger reindex for a specific entity type."""
        client = cls._get_client()
        reindex_fn_raw = getattr(client, "reindex", None)
        if callable(reindex_fn_raw):
            reindex_callback: ReindexCallback = cast(ReindexCallback, reindex_fn_raw)
            return reindex_callback(  # pylint: disable=not-callable
                entity_type=entity_type
            )
        return _http_post(client, f"/search/reindex/{entity_type}", {})

    @classmethod
    def reindex_all(cls) -> JsonDict:
        """Reindex all entities."""
        client = cls._get_client()
        reindex_all_fn_raw = getattr(client, "reindex_all", None)
        if callable(reindex_all_fn_raw):
            reindex_all_callback: ReindexAllCallback = cast(
                ReindexAllCallback, reindex_all_fn_raw
            )
            return reindex_all_callback()  # pylint: disable=not-callable
        return _http_post(client, "/search/reindex", {})

    @classmethod
    async def search_async(  # pylint: disable=too-many-arguments
        cls,
        query: str,
        index: Optional[str] = None,
        from_: int = 0,
        size: int = 10,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        filters: Optional[Mapping[str, Any]] = None,
    ) -> JsonDict:
        """Async variant of :meth:`search`."""
        return await _run_async(
            cls.search, query, index, from_, size, sort_field, sort_order, filters
        )

    @classmethod
    async def suggest_async(
        cls,
        query: str,
        field: Optional[str] = None,
        size: int = 5,
    ) -> List[str]:
        """Async variant of :meth:`suggest`."""
        return await _run_async(cls.suggest, query, field, size)

    @classmethod
    async def aggregate_async(
        cls,
        query: str,
        index: Optional[str] = None,
        field: Optional[str] = None,
    ) -> JsonDict:
        """Async variant of :meth:`aggregate`."""
        return await _run_async(cls.aggregate, query, index, field)

    @classmethod
    async def reindex_async(cls, entity_type: str) -> JsonDict:
        """Async variant of :meth:`reindex`."""
        return await _run_async(cls.reindex, entity_type)

    @classmethod
    async def reindex_all_async(cls) -> JsonDict:
        """Async variant of :meth:`reindex_all`."""
        return await _run_async(cls.reindex_all)

    @classmethod
    def builder(cls) -> "SearchBuilder":
        """Create a search builder."""
        return SearchBuilder()


class SearchBuilder:
    """Builder for search queries."""

    def __init__(self) -> None:
        self._query: Optional[str] = None
        self._index: Optional[str] = None
        self._from: int = 0
        self._size: int = 10
        self._sort_field: Optional[str] = None
        self._sort_order: Optional[str] = None
        self._filters: JsonDict = {}

    def query(self, query: str) -> "SearchBuilder":
        """Set search query."""
        self._query = query
        return self

    def index(self, index: str) -> "SearchBuilder":
        """Set search index."""
        self._index = index
        return self

    def from_(self, from_: int) -> "SearchBuilder":
        """Set starting offset."""
        self._from = from_
        return self

    def size(self, size: int) -> "SearchBuilder":
        """Set result size."""
        self._size = size
        return self

    def sort_field(self, field: str) -> "SearchBuilder":
        """Set sort field."""
        self._sort_field = field
        return self

    def sort_order(self, order: str) -> "SearchBuilder":
        """Set sort order."""
        self._sort_order = order
        return self

    def filter(self, key: str, value: Any) -> "SearchBuilder":
        """Add a filter."""
        self._filters[key] = value
        return self

    def execute(self) -> JsonDict:
        """Execute the search."""
        if not self._query:
            raise ValueError("Query is required")

        return Search.search(
            query=self._query,
            index=self._index,
            from_=self._from,
            size=self._size,
            sort_field=self._sort_field,
            sort_order=self._sort_order,
            filters=self._filters,
        )

    async def execute_async(self) -> JsonDict:
        """Execute the search asynchronously."""
        if not self._query:
            raise ValueError("Query is required")

        return await Search.search_async(
            query=self._query,
            index=self._index,
            from_=self._from,
            size=self._size,
            sort_field=self._sort_field,
            sort_order=self._sort_order,
            filters=self._filters,
        )
