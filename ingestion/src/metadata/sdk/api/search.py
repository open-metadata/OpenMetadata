"""
Search API with fluent interface
"""
import asyncio
from typing import ClassVar, Dict, List, Optional, Union

from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata


class Search:
    """Static fluent API for search operations"""

    _default_client: ClassVar[Optional[OMeta]] = None

    @classmethod
    def set_default_client(cls, client: Union[OpenMetadata, OMeta]):
        """Set the default client for static methods"""
        if isinstance(client, OpenMetadata):
            cls._default_client = client.ometa
        else:
            cls._default_client = client

    @classmethod
    def _get_client(cls) -> OMeta:
        """Get the default client"""
        if cls._default_client is None:
            cls._default_client = OpenMetadata.get_default_client()
        return cls._default_client

    @classmethod
    def search(
        cls,
        query: str,
        index: Optional[str] = None,
        from_: int = 0,
        size: int = 10,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        filters: Optional[Dict] = None,
    ) -> Dict:
        """Perform a search query"""
        client = cls._get_client()
        params = {
            "q": query,
            "from": from_,
            "size": size,
        }
        if index:
            params["index"] = index
        if sort_field:
            params["sort_field"] = sort_field
        if sort_order:
            params["sort_order"] = sort_order
        if filters:
            params.update(filters)
        
        return client.es_search_from_es(query_string=query, **params)

    @classmethod
    def suggest(
        cls,
        query: str,
        field: Optional[str] = None,
        size: int = 5,
    ) -> List[str]:
        """Get search suggestions"""
        client = cls._get_client()
        return client.get_suggest_entities(
            query_string=query, 
            field=field,
            size=size
        )

    @classmethod
    def aggregate(
        cls,
        query: str,
        index: Optional[str] = None,
        field: Optional[str] = None,
    ) -> Dict:
        """Perform aggregation query"""
        client = cls._get_client()
        params = {"q": query}
        if index:
            params["index"] = index
        if field:
            params["field"] = field
        
        return client.es_aggregate(query=query, **params)

    @classmethod
    def search_advanced(cls, search_request: Dict) -> Dict:
        """Perform advanced search with custom request body"""
        client = cls._get_client()
        return client.es_search_from_es(body=search_request)

    @classmethod
    def reindex(cls, entity_type: str) -> Dict:
        """Reindex a specific entity type"""
        client = cls._get_client()
        return client.reindex(entity_type=entity_type)

    @classmethod
    def reindex_all(cls) -> Dict:
        """Reindex all entities"""
        client = cls._get_client()
        return client.reindex_all()

    @classmethod
    async def search_async(
        cls,
        query: str,
        index: Optional[str] = None,
        from_: int = 0,
        size: int = 10,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
        filters: Optional[Dict] = None,
    ) -> Dict:
        """Async search"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.search, query, index, from_, size, sort_field, sort_order, filters
        )

    @classmethod
    async def suggest_async(
        cls,
        query: str,
        field: Optional[str] = None,
        size: int = 5,
    ) -> List[str]:
        """Async suggest"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.suggest, query, field, size)

    @classmethod
    async def aggregate_async(
        cls,
        query: str,
        index: Optional[str] = None,
        field: Optional[str] = None,
    ) -> Dict:
        """Async aggregate"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.aggregate, query, index, field)

    @classmethod
    async def reindex_async(cls, entity_type: str) -> Dict:
        """Async reindex"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.reindex, entity_type)

    @classmethod
    async def reindex_all_async(cls) -> Dict:
        """Async reindex all"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.reindex_all)

    @classmethod
    def builder(cls) -> "SearchBuilder":
        """Create a search builder"""
        return SearchBuilder()


class SearchBuilder:
    """Builder for search queries"""

    def __init__(self):
        self._query = None
        self._index = None
        self._from = 0
        self._size = 10
        self._sort_field = None
        self._sort_order = None
        self._filters = {}

    def query(self, query: str):
        """Set search query"""
        self._query = query
        return self

    def index(self, index: str):
        """Set search index"""
        self._index = index
        return self

    def from_(self, from_: int):
        """Set starting offset"""
        self._from = from_
        return self

    def size(self, size: int):
        """Set result size"""
        self._size = size
        return self

    def sort_field(self, field: str):
        """Set sort field"""
        self._sort_field = field
        return self

    def sort_order(self, order: str):
        """Set sort order"""
        self._sort_order = order
        return self

    def filter(self, key: str, value):
        """Add a filter"""
        self._filters[key] = value
        return self

    def execute(self) -> Dict:
        """Execute the search"""
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

    async def execute_async(self) -> Dict:
        """Execute the search asynchronously"""
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