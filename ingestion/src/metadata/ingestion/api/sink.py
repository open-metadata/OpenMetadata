from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Any, List, Dict

from .closeable import Closeable
from .common import WorkflowContext, Record
from .status import Status


@dataclass
class SinkStatus(Status):
    records: List[str] = field(default_factory=list)
    warnings: List[Any] = field(default_factory=list)
    failures: List[Any] = field(default_factory=list)

    def records_written(self, record: Record):
        self.records.append(record)

    def warning(self, info: Any) -> None:
        self.warnings.append(info)

    def failure(self, info: Any) -> None:
        self.failures.append(info)



@dataclass  # type: ignore[misc]
class Sink(Closeable, metaclass=ABCMeta):
    """All Sinks must inherit this base class."""

    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Sink":
        pass

    @abstractmethod
    def write_record(self, record: Record) -> None:
        # must call callback when done.
        pass

    @abstractmethod
    def get_status(self) -> SinkStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
