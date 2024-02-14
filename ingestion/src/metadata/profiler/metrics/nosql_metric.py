from abc import ABC, abstractmethod
from typing import Callable, TypeVar

from metadata.generated.schema.entity.data.table import Table
from metadata.profiler.adaptors.nosql_adaptor import NoSQLAdaptor

T = TypeVar("T")


class NoSQLMetric(ABC):
    """An interface for NoSQL metrics. This interface should be implemented by all NoSQL metrics."""

    @abstractmethod
    def nosql_fn(self, client: NoSQLAdaptor) -> Callable[[Table], T]:
        """Return the function to be used for NoSQL clients to calculate the metric."""
        pass
