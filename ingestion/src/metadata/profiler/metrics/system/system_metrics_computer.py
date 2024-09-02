from abc import ABC, abstractmethod
from typing import List

from metadata.generated.schema.entity.data.table import SystemProfile, Table
from metadata.utils.profiler_utils import QueryResult


class SystemMetricsComputer(ABC):
    @abstractmethod
    def compute(self) -> List[SystemProfile]:
        raise NotImplementedError

    def extract_system_metrics(
        self, table: Table, entry: QueryResult
    ) -> List[SystemProfile]:
        return self.compute()
