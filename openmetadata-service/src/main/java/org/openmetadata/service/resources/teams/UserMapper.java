package org.openmetadata.service.resources.teams;

import java.util.UUID;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class UserMapper implements EntityMapper<User, CreateUser> {
  @Override
  public User createToEntity(CreateUser create, String user) {
    return new User()
        .withId(UUID.randomUUID())
        .withName(create.getName().toLowerCase())
        .withFullyQualifiedName(EntityInterfaceUtil.quoteName(create.getName().toLowerCase()))
        .withEmail(create.getEmail().toLowerCase())
        .withDescription(create.getDescription())
        .withDisplayName(create.getDisplayName())
        .withIsBot(create.getIsBot())
        .withIsAdmin(create.getIsAdmin())
        .withProfile(create.getProfile())
        .withPersonas(create.getPersonas())
        .withDefaultPersona(create.getDefaultPersona())
        .withTimezone(create.getTimezone())
        .withUpdatedBy(user.toLowerCase())
        .withUpdatedAt(System.currentTimeMillis())
        .withTeams(EntityUtil.toEntityReferences(create.getTeams(), Entity.TEAM))
        .withRoles(EntityUtil.toEntityReferences(create.getRoles(), Entity.ROLE))
        .withDomains(EntityUtil.getEntityReferences(Entity.DOMAIN, create.getDomains()));
  }
}
