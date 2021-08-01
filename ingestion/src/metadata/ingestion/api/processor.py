from abc import ABCMeta, abstractmethod
from dataclasses import dataclass, field
from typing import Any, List

from .closeable import Closeable
from .common import WorkflowContext, Record
from .status import Status


@dataclass
class ProcessorStatus(Status):
    records = 0
    warnings: List[Any] = field(default_factory=list)
    failures: List[Any] = field(default_factory=list)

    def records_processed(self, record: Record):
        self.records += 1

    def warning(self, info: Any) -> None:
        self.warnings.append(info)

    def failure(self, info: Any) -> None:
        self.failures.append(info)


@dataclass
class Processor(Closeable, metaclass=ABCMeta):
    ctx: WorkflowContext

    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext) -> "Processor":
        pass

    @abstractmethod
    def process(self, record: Record) -> Record:
        pass

    @abstractmethod
    def get_status(self) -> ProcessorStatus:
        pass

    @abstractmethod
    def close(self) -> None:
        pass
