"""
Team entity wrapper with clean API following Java SDK patterns.
"""
from typing import Type

from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.entity.teams.team import Team as TeamEntity
from metadata.sdk.entities.base import BaseEntity


class Team(BaseEntity[TeamEntity, CreateTeamRequest]):
    """
    Team entity wrapper with static methods for CRUD operations.

    Example usage:
        # Create a team
        create_request = CreateTeamRequest(
            name="data-engineering",
            displayName="Data Engineering",
            description="Data Engineering team",
            teamType="Department"
        )
        team = Team.create(create_request)

        # Retrieve a team
        team = Team.retrieve(team_id)
        team = Team.retrieve_by_name("data-engineering")

        # Update a team
        team.description = "Core Data Engineering team"
        updated = Team.update(team.id, team)

        # Patch a team - add users
        patch = [
            {"op": "add", "path": "/users/0", "value": {"id": "user-id-1"}},
            {"op": "add", "path": "/users/1", "value": {"id": "user-id-2"}}
        ]
        patched = Team.patch(team.id, patch)

        # Delete a team
        Team.delete(team.id)

        # List teams with fields
        teams = Team.list(fields=["users", "owns", "defaultRoles"])
    """

    @classmethod
    def entity_type(cls) -> Type[TeamEntity]:
        """Return the Team entity type"""
        return TeamEntity
