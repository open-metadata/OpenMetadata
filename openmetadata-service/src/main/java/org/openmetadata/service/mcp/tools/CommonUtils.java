package org.openmetadata.service.mcp.tools;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;

@Slf4j
public class CommonUtils {

  public static <T extends CreateEntity> void setOwners(T entity, Map<String, Object> params) {

    List<EntityReference> owners = getTeamsOrUsers(params.get("owners"));

    if (!owners.isEmpty()) {
      entity.setOwners(owners);
    }
  }

  public static List<EntityReference> getTeamsOrUsers(Object teamsOrUsersParam) {
    UserRepository userRepository = Entity.getUserRepository();
    TeamRepository teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
    List<EntityReference> teamsOrUsers = new java.util.ArrayList<>();

    for (String owner : JsonUtils.readOrConvertValues(teamsOrUsersParam, String.class)) {
      try {
        User user = userRepository.findByNameOrNull(owner, Include.NON_DELETED);
        if (user == null) {
          // If the owner is not a user, check if it's a team
          Team team = teamRepository.findByNameOrNull(owner, Include.NON_DELETED);
          if (team != null) {
            teamsOrUsers.add(team.getEntityReference());
          }
        } else {
          // If the owner is a user, add their reference
          teamsOrUsers.add(user.getEntityReference());
        }
      } catch (Exception e) {
        LOG.error(String.format("Could not add teams or users '%s' due to", e.getMessage()), e);
      }
    }
    return teamsOrUsers;
  }
}
