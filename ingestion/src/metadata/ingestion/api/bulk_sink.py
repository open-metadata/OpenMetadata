from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Any, List, Dict

from .closeable import Closeable
from .common import WorkflowContext,  Record
from .status import Status


@dataclass
class BulkSinkStatus(Status):
    records = 0
    warnings: List[Any] = field(default_factory=list)
    failures: List[Any] = field(default_factory=list)

    def records_written(self, records: int):
        self.records += records

    def warning(self, info: Any) -> None:
        self.warnings.append(info)

    def failure(self, info: Any) -> None:
        self.failures.append(info)


@dataclass  # type: ignore[misc]
class BulkSink(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "BulkSink":
        pass

    @abstractmethod
    def write_records(self) -> None:
        pass

    @abstractmethod
    def get_status(self) -> BulkSinkStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass