"""
Classifications entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.classification.createClassification import (
    CreateClassificationRequest,
)
from metadata.generated.schema.entity.classification.classification import (
    Classification,
)
from metadata.sdk.entities.base import BaseEntity


class Classifications(BaseEntity[Classification, CreateClassificationRequest]):
    """Classifications SDK class - plural to avoid conflict with generated Classification entity"""

    @classmethod
    def entity_type(cls) -> Type[Classification]:
        """Return the Classification entity type"""
        return Classification
