from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, Generic, Iterable, List, TypeVar, Any

from .closeable import Closeable
from .common import WorkflowContext, Record
from .status import Status


@dataclass
class StageStatus(Status):
    records_produced = 0

    warnings: Dict[str, List[str]] = field(default_factory=dict)
    failures: Dict[str, List[str]] = field(default_factory=dict)

    def records_status(self, record: Record) -> None:
        self.records_produced += 1

    def warning_status(self, key: str, reason: str) -> None:
        if key not in self.warnings:
            self.warnings[key] = []
        self.warnings[key].append(reason)

    def failure_status(self, key: str, reason: str) -> None:
        if key not in self.failures:
            self.failures[key] = []
        self.failures[key].append(reason)


RecordType = TypeVar("RecordType", bound=Record)


@dataclass  # type: ignore[misc]
class Stage(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Stage":
        pass

    @abstractmethod
    def stage_record(self, record: Record):
        pass

    @abstractmethod
    def get_status(self) -> StageStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
