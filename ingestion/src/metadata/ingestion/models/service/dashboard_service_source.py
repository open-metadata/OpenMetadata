from abc import ABCMeta, abstractmethod

from metadata.ingestion.api.source import Source


class DashboardSourceService(Source, metaclass=ABCMeta):
    @abstractmethod
    def fetch_dashboards(self) -> None:
        pass

    @abstractmethod
    def fetch_charts(self) -> None:
        pass
