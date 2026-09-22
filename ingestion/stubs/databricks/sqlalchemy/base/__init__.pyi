from typing import Any

from sqlalchemy.engine.interfaces import Dialect

class DatabricksDialect(Dialect):
    statement_compiler: type[Any]
    is_disconnect: Any
    def get_columns(self, *args: Any, **kwargs: Any) -> list[Any]: ...
    def get_table_comment(self, *args: Any, **kwargs: Any) -> dict[str, Any]: ...
    def get_view_names(self, *args: Any, **kwargs: Any) -> list[str]: ...
