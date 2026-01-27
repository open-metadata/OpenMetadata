"""
MLModels entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createMlModel import CreateMlModelRequest
from metadata.generated.schema.entity.data.mlmodel import MlModel
from metadata.sdk.entities.base import BaseEntity


class MLModels(BaseEntity[MlModel, CreateMlModelRequest]):
    """MLModels SDK class - plural to avoid conflict with generated MlModel entity"""

    @classmethod
    def entity_type(cls) -> Type[MlModel]:
        """Return the MlModel entity type"""
        return MlModel
