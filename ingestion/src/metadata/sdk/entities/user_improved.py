"""
Improved User entity wrapper with clean API following Java SDK patterns.
"""
from typing import Type

from metadata.generated.schema.api.teams.createUser import CreateUserRequest
from metadata.generated.schema.entity.teams.user import User as UserEntity
from metadata.sdk.entities.base import BaseEntity


class User(BaseEntity[UserEntity, CreateUserRequest]):
    """
    User entity wrapper with static methods for CRUD operations.

    Example usage:
        # Create a user
        create_request = CreateUserRequest(
            name="john.doe",
            email="john.doe@company.com",
            displayName="John Doe",
            description="Senior Data Engineer"
        )
        user = User.create(create_request)

        # Retrieve a user
        user = User.retrieve(user_id)
        user = User.retrieve_by_name("john.doe")

        # Update a user
        user.description = "Principal Data Engineer"
        updated = User.update(user.id, user)

        # Patch a user - add teams and roles
        patch = [
            {"op": "add", "path": "/teams/0", "value": {"id": "team-id"}},
            {"op": "add", "path": "/roles/0", "value": {"id": "role-id"}}
        ]
        patched = User.patch(user.id, patch)

        # Delete a user
        User.delete(user.id, hard_delete=True)

        # List users with pagination
        users = User.list(limit=50, fields=["teams", "roles", "owns"])
    """

    @classmethod
    def entity_type(cls) -> Type[UserEntity]:
        """Return the User entity type"""
        return UserEntity
