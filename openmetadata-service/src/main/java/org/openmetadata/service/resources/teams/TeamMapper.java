package org.openmetadata.service.resources.teams;

import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_GROUP;
import static org.openmetadata.service.exception.CatalogExceptionMessage.CREATE_ORGANIZATION;

import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class TeamMapper implements EntityMapper<Team, CreateTeam> {
  @Override
  public Team createToEntity(CreateTeam create, String user) {
    if (create.getTeamType().equals(CreateTeam.TeamType.ORGANIZATION)) {
      throw new IllegalArgumentException(CREATE_ORGANIZATION);
    }
    if (create.getTeamType().equals(CreateTeam.TeamType.GROUP) && create.getChildren() != null) {
      throw new IllegalArgumentException(CREATE_GROUP);
    }
    return copy(new Team(), create, user)
        .withProfile(create.getProfile())
        .withIsJoinable(create.getIsJoinable())
        .withUsers(EntityUtil.toEntityReferences(create.getUsers(), Entity.USER))
        .withDefaultRoles(EntityUtil.toEntityReferences(create.getDefaultRoles(), Entity.ROLE))
        .withTeamType(create.getTeamType())
        .withParents(EntityUtil.toEntityReferences(create.getParents(), Entity.TEAM))
        .withChildren(EntityUtil.toEntityReferences(create.getChildren(), Entity.TEAM))
        .withPolicies(EntityUtil.toEntityReferences(create.getPolicies(), Entity.POLICY))
        .withEmail(create.getEmail())
        .withDomains(EntityUtil.getEntityReferences(Entity.DOMAIN, create.getDomains()));
  }
}
