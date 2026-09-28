"""
Tags entity SDK with fluent API
"""

from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.sdk.entities.base import BaseEntity


class Tags(BaseEntity[Tag, CreateTagRequest]):
    """Tags SDK class - plural to avoid conflict with generated Tag entity"""

    @classmethod
    def entity_type(cls) -> type[Tag]:
        """Return the Tag entity type"""
        return Tag
