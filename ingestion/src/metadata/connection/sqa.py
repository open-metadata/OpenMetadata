from sqlalchemy.engine import Connection
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.connections import get_connection


class SqlAlchemyConnection:
    def __init__(self, engine: Engine, context: TopologyContextManager):
        self._engine = engine
        self._context = context
        self._connection_map = {}
        self._inspector_map = {}

    @classmethod
    def from_config(cls, service_connection, context: TopologyContextManager) -> "SqlAlchemyConnection":
        return cls(
            get_connection(service_connection),
            context
        )

    @property
    def connection(self) -> Connection:
        """
        Return the SQLAlchemy connection
        """
        thread_id = self._context.get_current_thread_id()

        if not self._connection_map.get(thread_id):
            self._connection_map[thread_id] = self._engine.connect()

        return self._connection_map[thread_id]

    @property
    def inspector(self) -> Inspector:
        thread_id = self._context.get_current_thread_id()

        if not self._inspector_map.get(thread_id):
            self._inspector_map[thread_id] = inspect(self.connection)

        return self._inspector_map[thread_id]

    def close(self):
        for connection in self._connection_map.values():
            connection.close()
        self._engine.dispose()
