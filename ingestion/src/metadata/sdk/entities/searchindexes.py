"""
SearchIndexes entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.data.createSearchIndex import (
    CreateSearchIndexRequest,
)
from metadata.generated.schema.entity.data.searchIndex import SearchIndex
from metadata.sdk.entities.base import BaseEntity


class SearchIndexes(BaseEntity[SearchIndex, CreateSearchIndexRequest]):
    """SearchIndexes SDK class - plural to avoid conflict with generated SearchIndex entity"""

    @classmethod
    def entity_type(cls) -> Type[SearchIndex]:
        """Return the SearchIndex entity type"""
        return SearchIndex
