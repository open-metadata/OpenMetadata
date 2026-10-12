"""
Queries entity SDK with fluent API
"""

from metadata.generated.schema.api.data.createQuery import CreateQueryRequest
from metadata.generated.schema.entity.data.query import Query
from metadata.sdk.entities.base import BaseEntity


class Queries(BaseEntity[Query, CreateQueryRequest]):
    """Queries SDK class - plural to avoid conflict with generated Query entity"""

    @classmethod
    def entity_type(cls) -> type[Query]:
        """Return the Query entity type"""
        return Query
