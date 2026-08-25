"""
Teams entity SDK with fluent API
"""

from typing import Type  # noqa: UP035

from metadata.generated.schema.api.teams.createTeam import CreateTeamRequest
from metadata.generated.schema.entity.teams.team import Team
from metadata.sdk.entities.base import BaseEntity


class Teams(BaseEntity[Team, CreateTeamRequest]):
    """Teams SDK class - plural to avoid conflict with generated Team entity"""

    @classmethod
    def entity_type(cls) -> Type[Team]:  # noqa: UP006
        """Return the Team entity type"""
        return Team
