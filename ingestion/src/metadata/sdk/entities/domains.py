"""
Domains entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.domains.createDomain import CreateDomainRequest
from metadata.generated.schema.entity.domains.domain import Domain
from metadata.sdk.entities.base import BaseEntity


class Domains(BaseEntity[Domain, CreateDomainRequest]):
    """Domains SDK class - plural to avoid conflict with generated Domain entity"""

    @classmethod
    def entity_type(cls) -> Type[Domain]:  # noqa: UP006
        """Return the Domain entity type"""
        return Domain
