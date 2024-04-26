from typing import Optional
from sqlalchemy.engine import Engine, Connection
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.ingestion.models.topology import TopologyContextManager
from metadata.utils.ssl_manager import SSLManager

class SqlAlchemyConnection:
    def __init__(
        self,
        engine: Engine,
        context: TopologyContextManager,
        ssl_manager: Optional[SSLManager] = None
    ):
        self._engine = engine
        self._context = context
        self._ssl_manager = ssl_manager

        self._connection_map = {}
        self._inspector_map = {}

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

    def set_database(self, database_name: str):
        self._engine.url.set(database=database_name)
        self._connection_map = {}
        self._inspector_map = {}

    def close(self):
        for connection in self._connection_map.values():
            connection.close()
        self._engine.dispose()

        if self._ssl_manager:
            self._ssl_manager.cleanup_temp_files()
