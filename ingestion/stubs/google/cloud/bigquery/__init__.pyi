from collections.abc import Iterator
from typing import Any

from google.auth.credentials import Credentials

class Client:
    project: str
    def __init__(
        self,
        project: str | None = None,
        credentials: Credentials | None = None,
        location: str | None = None,
        **kwargs: Any,
    ) -> None: ...
    def query(self, query: str, **kwargs: Any) -> QueryJob: ...
    def list_tables(self, dataset: Any, **kwargs: Any) -> Iterator[Any]: ...
    def get_table(self, table: Any) -> Any: ...

class QueryJob:
    def result(self, **kwargs: Any) -> Any: ...
