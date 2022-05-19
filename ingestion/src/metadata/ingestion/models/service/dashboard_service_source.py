from abc import ABCMeta, abstractmethod
from dataclasses import dataclass

from metadata.ingestion.api.source import Source


@dataclass  # type: ignore[misc]
class DashboardSourceService(Source, metaclass=ABCMeta):
    @abstractmethod
    def fetch_dashboards(self) -> None:
        pass

    @abstractmethod
    def fetch_charts(self) -> None:
        pass
