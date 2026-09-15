"""
Teams entity SDK with fluent API
"""

from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.entity.teams.team import Team
from metadata.sdk.entities.base import BaseEntity


class Teams(BaseEntity[Team, CreateTeamRequest]):
    """Teams SDK class - plural to avoid conflict with generated Team entity"""

    @classmethod
    def entity_type(cls) -> type[Team]:
        """Return the Team entity type"""
        return Team
