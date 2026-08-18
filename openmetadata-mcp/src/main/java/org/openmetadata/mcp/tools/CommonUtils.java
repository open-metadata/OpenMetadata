package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

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

  /**
   * Custom properties for the entity being created, as {@code {propertyName: value}}, or null when
   * the caller supplied none. Returned rather than set on the request because {@code CreateEntity}
   * exposes no {@code setExtension}; each tool assigns it on its own concrete request type.
   */
  public static Object extension(Map<String, Object> params) {
    Object raw = params.get("extension");
    if (raw != null && !(raw instanceof Map)) {
      throw new IllegalArgumentException(
          "Parameter 'extension' must be an object mapping custom property names to values."
              + " Received: "
              + raw);
    }
    return raw;
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
   * Re-authorizes the update leg of a {@code createOrUpdate} as {@link MetadataOperation#EDIT_ALL}
   * against the entity that already exists at this fully qualified name.
   *
   * <p>The {@code create_*} tools authorize {@link MetadataOperation#CREATE} against a {@code
   * CreateResourceContext} for the new entity and then call {@code EntityRepository.createOrUpdate},
   * which updates in place when the name is taken. A caller holding Create but not Edit could
   * therefore overwrite an entity owned by somebody else, discarding its description, owners and
   * tags. The REST layer does not have this gap: {@code EntityResource.createOrUpdate} derives
   * EDIT_ALL through {@code EntityUtil.createOrUpdateOperation} and authorizes it against the
   * <em>existing</em> entity, returning 403. This helper restores that parity.
   *
   * <p>The upsert semantics are intentional and unchanged — only the authorization leg moves. Call
   * this after {@code prepareInternal}, which is what resolves the fully qualified name, and before
   * {@code createOrUpdate}. The existence lookup is deliberate rather than redundant: the tool has
   * to know whether this call creates or updates <em>before</em> the write, exactly as the REST path
   * reads the original entity to build its resource context.
   *
   * @param entityType the entity type being written, e.g. {@link Entity#TAG}
   * @param entity the prepared entity, carrying the resolved fully qualified name
   */
  public static void authorizeOverwrite(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      String entityType,
      EntityInterface entity) {
    String fqn = entity.getFullyQualifiedName();
    // Include.ALL because createOrUpdate finds the original with ALL: a soft-deleted entity at
    // this name is still updated in place, so it still needs the EDIT_ALL check.
    boolean overwritesExisting = fqn != null && entityExistsByName(entityType, fqn, Include.ALL);
    if (overwritesExisting) {
      OperationContext editContext = new OperationContext(entityType, MetadataOperation.EDIT_ALL);
      ResourceContext<EntityInterface> existing =
          new ResourceContext<>(entityType, null, fqn, Include.ALL);
      authorizer.authorize(securityContext, editContext, existing);
    }
  }

  /**
   * Returns true when an entity with the given name exists. Only an {@link EntityNotFoundException}
   * counts as "does not exist" — any other failure (DB outage, etc.) propagates so a real infra
   * error is never mislabelled as a missing entity.
   */
  public static boolean entityExistsByName(String entityType, String fqn) {
    return entityExistsByName(entityType, fqn, Include.NON_DELETED);
  }

  public static boolean entityExistsByName(String entityType, String fqn, Include include) {
    boolean exists = true;
    try {
      Entity.getEntityReferenceByName(entityType, fqn, include);
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
