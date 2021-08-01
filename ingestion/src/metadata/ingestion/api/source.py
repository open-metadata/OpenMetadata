from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Generic, Iterable, List, TypeVar, Any

from .closeable import Closeable
from .common import WorkflowContext, Record
from .status import Status


@dataclass
class SourceStatus(Status):
    records = 0

    warnings: Dict[str, List[str]] = field(default_factory=dict)
    failures: Dict[str, List[str]] = field(default_factory=dict)

    def records_produced(self, record: Record) -> None:
        self.records += 1

    def warning(self, key: str, reason: str) -> None:
        if key not in self.warnings:
            self.warnings[key] = []
        self.warnings[key].append(reason)

    def failure(self, key: str, reason: str) -> None:
        if key not in self.failures:
            self.failures[key] = []
        self.failures[key].append(reason)



@dataclass  # type: ignore[misc]
class Source(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Source":
        pass

    @abstractmethod
    def prepare(self):
        pass

    @abstractmethod
    def next_record(self) -> Iterable[Record]:
        pass

    @abstractmethod
    def get_status(self) -> SourceStatus:
        pass