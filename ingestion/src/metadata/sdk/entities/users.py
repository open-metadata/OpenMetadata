"""
Users entity SDK with fluent API
"""
from typing import Type

from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.user import User
from metadata.sdk.entities.base import BaseEntity


class Users(BaseEntity[User, CreateUserRequest]):
    """Users SDK class - plural to avoid conflict with generated User entity"""

    @classmethod
    def entity_type(cls) -> Type[User]:
        """Return the User entity type"""
        return User
