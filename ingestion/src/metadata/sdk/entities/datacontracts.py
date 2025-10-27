"""
DataContracts entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createDataContract import (
    CreateDataContractRequest,
)
from metadata.generated.schema.entity.data.dataContract import DataContract
from metadata.sdk.entities.base import BaseEntity


class DataContracts(BaseEntity[DataContract, CreateDataContractRequest]):
    """DataContracts SDK class - plural to avoid conflict with generated DataContract entity"""

    @classmethod
    def entity_type(cls) -> Type[DataContract]:
        """Return the DataContract entity type"""
        return DataContract
