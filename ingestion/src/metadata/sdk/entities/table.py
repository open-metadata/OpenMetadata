"""
Table entity with fluent API
"""
import asyncio
from typing import ClassVar, Dict, Iterator, List, Optional, Union

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table as TableEntity
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk.client import OpenMetadata


class Table:
    """Table entity with static fluent API methods"""

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
    def create(cls, request: CreateTableRequest) -> TableEntity:
        """Create a new table"""
        client = cls._get_client()
        return client.create_or_update(request)

    @classmethod
    def retrieve(cls, table_id: str, fields: Optional[List[str]] = None) -> TableEntity:
        """Retrieve a table by ID"""
        client = cls._get_client()
        return client.get_by_id(entity=TableEntity, entity_id=table_id, fields=fields)

    @classmethod
    def retrieve_by_name(
        cls, fqn: str, fields: Optional[List[str]] = None
    ) -> TableEntity:
        """Retrieve a table by fully qualified name"""
        client = cls._get_client()
        return client.get_by_name(entity=TableEntity, fqn=fqn, fields=fields)

    @classmethod
    def list(cls, params: Optional["TableListParams"] = None) -> "TableCollection":
        """List tables with optional parameters"""
        return TableCollection(cls._get_client(), params)

    @classmethod
    def update(cls, table_id: str, table: TableEntity) -> TableEntity:
        """Update a table"""
        client = cls._get_client()
        table.id = table_id
        return client.create_or_update(table)

    @classmethod
    def patch(cls, table_id: str, json_patch: List[Dict]) -> TableEntity:
        """Apply JSON patch to a table"""
        client = cls._get_client()
        return client.patch(
            entity=TableEntity, entity_id=table_id, json_patch=json_patch
        )

    @classmethod
    def delete(cls, table_id: str, recursive: bool = False, hard_delete: bool = False):
        """Delete a table"""
        client = cls._get_client()
        client.delete(
            entity=TableEntity,
            entity_id=table_id,
            recursive=recursive,
            hard_delete=hard_delete,
        )

    @classmethod
    def export_csv(cls, name: str) -> str:
        """Export table metadata to CSV"""
        client = cls._get_client()
        return client.export_csv(entity=TableEntity, name=name)

    @classmethod
    def import_csv(cls, csv_data: str, dry_run: bool = False) -> str:
        """Import table metadata from CSV"""
        client = cls._get_client()
        return client.import_csv(entity=TableEntity, csv_data=csv_data, dry_run=dry_run)

    @classmethod
    async def create_async(cls, request: CreateTableRequest) -> TableEntity:
        """Async create a table"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.create, request)

    @classmethod
    async def retrieve_async(
        cls, table_id: str, fields: Optional[List[str]] = None
    ) -> TableEntity:
        """Async retrieve a table"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.retrieve, table_id, fields)

    @classmethod
    async def delete_async(
        cls, table_id: str, recursive: bool = False, hard_delete: bool = False
    ):
        """Async delete a table"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, cls.delete, table_id, recursive, hard_delete
        )

    @classmethod
    async def export_csv_async(cls, name: str) -> str:
        """Async export table metadata to CSV"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.export_csv, name)

    @classmethod
    async def import_csv_async(cls, csv_data: str, dry_run: bool = False) -> str:
        """Async import table metadata from CSV"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls.import_csv, csv_data, dry_run)


class TableCollection:
    """Collection of tables with iteration support"""

    def __init__(self, client: OMeta, params: Optional["TableListParams"] = None):
        self.client = client
        self.params = params or TableListParams()

    def get_data(self) -> List[TableEntity]:
        """Get the current page of data"""
        return self.client.list_entities(
            entity=TableEntity,
            limit=self.params.limit,
            before=self.params.before,
            after=self.params.after,
            fields=self.params.fields,
            params=self.params.to_dict(),
        ).entities

    def auto_paging_iterable(self) -> Iterator[TableEntity]:
        """Return an iterator that automatically pages through results"""
        after = self.params.after
        while True:
            response = self.client.list_entities(
                entity=TableEntity,
                limit=self.params.limit,
                before=self.params.before,
                after=after,
                fields=self.params.fields,
                params=self.params.to_dict(),
            )

            for entity in response.entities:
                yield entity

            if not response.paging or not response.paging.after:
                break

            after = response.paging.after


class TableListParams:
    """Parameters for listing tables"""

    def __init__(
        self,
        limit: int = 10,
        before: Optional[str] = None,
        after: Optional[str] = None,
        fields: Optional[List[str]] = None,
        database: Optional[str] = None,
        database_schema: Optional[str] = None,
        service: Optional[str] = None,
    ):
        self.limit = limit
        self.before = before
        self.after = after
        self.fields = fields
        self.database = database
        self.database_schema = database_schema
        self.service = service

    @classmethod
    def builder(cls):
        """Create a parameters builder"""
        return TableListParamsBuilder()

    def to_dict(self) -> Dict:
        """Convert to dictionary for API call"""
        params = {}
        if self.database:
            params["database"] = self.database
        if self.database_schema:
            params["databaseSchema"] = self.database_schema
        if self.service:
            params["service"] = self.service
        return params


class TableListParamsBuilder:
    """Builder for table list parameters"""

    def __init__(self):
        self._limit = 10
        self._before = None
        self._after = None
        self._fields = None
        self._database = None
        self._database_schema = None
        self._service = None

    def limit(self, limit: int):
        """Set result limit"""
        self._limit = limit
        return self

    def before(self, before: str):
        """Set before cursor"""
        self._before = before
        return self

    def after(self, after: str):
        """Set after cursor"""
        self._after = after
        return self

    def fields(self, fields: List[str]):
        """Set fields to include"""
        self._fields = fields
        return self

    def database(self, database: str):
        """Filter by database"""
        self._database = database
        return self

    def database_schema(self, schema: str):
        """Filter by database schema"""
        self._database_schema = schema
        return self

    def service(self, service: str):
        """Filter by service"""
        self._service = service
        return self

    def build(self) -> TableListParams:
        """Build parameters"""
        return TableListParams(
            limit=self._limit,
            before=self._before,
            after=self._after,
            fields=self._fields,
            database=self._database,
            database_schema=self._database_schema,
            service=self._service,
        )
