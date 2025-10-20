"""
DataProducts entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.domains.createDataProduct import (
    CreateDataProductRequest,
)
from metadata.generated.schema.entity.domains.dataProduct import DataProduct
from metadata.sdk.entities.base import BaseEntity


class DataProducts(BaseEntity[DataProduct, CreateDataProductRequest]):
    """DataProducts SDK class - plural to avoid conflict with generated DataProduct entity"""

    @classmethod
    def entity_type(cls) -> Type[DataProduct]:
        """Return the DataProduct entity type"""
        return DataProduct
