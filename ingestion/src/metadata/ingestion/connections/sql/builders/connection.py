from typing import Optional
from sqlalchemy.engine import Engine

from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.connections.sql.connection import SqlAlchemyConnection
from metadata.utils.ssl_manager import SSLManager

class SqlAlchemyConnectionBuilder:
    def __init__(
        self,
        engine: Engine,
    ):
        self._engine = engine
        self._context = None
        self._ssl_manager = None

    @classmethod
    def from_config(cls, service_connection) -> "SqlAlchemyConnectionBuilder":
        return get_connection(service_connection)

    def with_ssl_manager(self, ssl_manager: SSLManager) -> "SqlAlchemyConnectionBuilder":
        self._ssl_manager = ssl_manager
        return self

    def with_context(self, context: TopologyContextManager) -> "SqlAlchemyConnectionBuilder":
        self._context = context
        return self

    def build(self):
        return SqlAlchemyConnection(
            engine=self._engine,
            context=self._context,
            ssl_manager=self._ssl_manager
        )
