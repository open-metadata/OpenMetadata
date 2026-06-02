package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

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
        LOG.error(
            "Could not resolve owner or reviewer '{}' to a user or team: {}",
            owner,
            e.getMessage(),
            e);
      }
    }
    return teamsOrUsers;
  }

  public static String principal(CatalogSecurityContext securityContext) {
    return securityContext.getUserPrincipal().getName();
  }

  public static String requireNonBlank(Object raw, String name) {
    if (!(raw instanceof String s) || s.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter '" + name + "' is required and must be a non-blank string. Received: " + raw);
    }
    return s;
  }

  public static String optString(Map<String, Object> params, String key) {
    Object raw = params.get(key);
    String result = null;
    if (raw != null) {
      if (!(raw instanceof String s)) {
        throw new IllegalArgumentException(
            "Parameter '" + key + "' must be a string. Received: " + raw);
      }
      result = s;
    }
    return result;
  }

  public static Boolean parseBoolean(Object raw, String name) {
    Boolean result;
    if (raw instanceof Boolean b) {
      result = b;
    } else if (raw instanceof String s
        && ("true".equalsIgnoreCase(s) || "false".equalsIgnoreCase(s))) {
      result = Boolean.valueOf(s.toLowerCase(Locale.ROOT));
    } else {
      throw new IllegalArgumentException(
          "Parameter '" + name + "' must be boolean or 'true'/'false'. Received: " + raw);
    }
    return result;
  }

  /**
   * Returns true when an entity with the given name exists. Only an {@link EntityNotFoundException}
   * counts as "does not exist" — any other failure (DB outage, etc.) propagates so a real infra
   * error is never mislabelled as a missing entity.
   */
  public static boolean entityExistsByName(String entityType, String fqn) {
    boolean exists = true;
    try {
      Entity.getEntityReferenceByName(entityType, fqn, Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      exists = false;
    }
    return exists;
  }

  public static void requireExists(String entityType, String fqn, String notFoundMessage) {
    if (!entityExistsByName(entityType, fqn)) {
      throw new IllegalArgumentException(notFoundMessage);
    }
  }

  public static void preflightDomains(List<String> domains) {
    for (String domain : domains) {
      requireExists(
          Entity.DOMAIN,
          domain,
          "Domain '"
              + domain
              + "' not found. Verify the domain FQN using search_metadata with"
              + " entityType='domain'.");
    }
  }

  public static void preflightExperts(List<String> experts) {
    for (String expert : experts) {
      requireExists(
          Entity.USER,
          expert,
          "Expert user '"
              + expert
              + "' not found. Use the OpenMetadata login name (e.g. 'john.doe').");
    }
  }

  public static List<TagLabel> buildTagLabels(Object tagsParam) {
    List<TagLabel> tags = new ArrayList<>();
    for (String tagFqn : JsonUtils.readOrConvertValues(tagsParam, String.class)) {
      tags.add(
          new TagLabel()
              .withTagFQN(tagFqn)
              .withSource(TagLabel.TagSource.CLASSIFICATION)
              .withLabelType(TagLabel.LabelType.MANUAL));
    }
    return tags;
  }
}
