from abc import ABC, abstractmethod

from pydantic import BaseModel

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.processor.sampler.sqlalchemy.sampler import SQASampler


class RuntimeParameterSetter(ABC):
    def __init__(
        self, ometa_client: OpenMetadata, service_connection_config, table_entity: Table, sampler: SQASampler
    ):
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config
        self.table_entity = table_entity
        self.sampler = sampler

    @abstractmethod
    def get_parameters(self, test_case) -> BaseModel:
        raise NotImplementedError
