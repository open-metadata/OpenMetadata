package org.openmetadata.mcp.tools;

import jakarta.ws.rs.core.SecurityContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
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
import org.openmetadata.service.resources.context.ContextMemoryVisibility;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class CommonUtils {

  /**
   * Reads an entity for a caller and applies that entity's own visibility rule before handing it
   * back. Rules like a context memory's {@code shareConfig} sit outside the policy model, so the
   * {@code authorizer.authorize(...)} a tool makes cannot see them - binding the check to the fetch
   * is what stops a read path from holding an entity it is not allowed to answer with. The rule is
   * a no-op for entity types that have none, so callers need no per-type knowledge.
   */
  public static EntityInterface readEntityForCaller(
      String entityType,
      String fqn,
      String fields,
      Include include,
      SecurityContext securityContext) {
    EntityInterface entity =
        Entity.getEntityByName(
            entityType, fqn, ContextMemoryVisibility.guardFields(entityType, fields), include);
    ContextMemoryVisibility.enforceVisibility(entity, securityContext);
    return entity;
  }

  /**
   * The same guard for a write whose response carries the entity back, which makes it a read too.
   * Reads the entity only when its type has visibility rules, so an ordinary patch keeps its single
   * repository fetch.
   */
  public static void enforceEntityVisibility(
      String entityType, String fqn, SecurityContext securityContext) {
    if (ContextMemoryVisibility.hasVisibilityRules(entityType)) {
      readEntityForCaller(entityType, fqn, "", Include.NON_DELETED, securityContext);
    }
  }

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
   * Resolves owner names and fails on any that do not resolve, instead of dropping them.
   *
   * <p>{@link #getTeamsOrUsers} returns only what it could resolve and says nothing about the rest:
   * {@code findByNameOrNull} returning null is not an exception, so nothing is thrown or logged.
   * On an update that is data loss - one misspelled name resolves to an empty list, a {@code set}
   * writes it, and every existing owner is deleted with a success response.
   *
   * @param owners the raw {@code owners} parameter, a string or list of strings
   * @param paramName the parameter name to quote in the error
   */
  public static List<EntityReference> requireTeamsOrUsers(Object owners, String paramName) {
    List<String> requested =
        JsonUtils.readOrConvertValues(owners, String.class).stream().distinct().toList();
    List<EntityReference> resolved = getTeamsOrUsers(owners);
    Set<String> found =
        resolved.stream().map(ref -> comparableName(ref.getName())).collect(Collectors.toSet());
    List<String> missing =
        requested.stream().filter(name -> !found.contains(comparableName(name))).toList();
    if (!missing.isEmpty()) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter '%s': no user or team found for %s. Nothing was changed. Look the name up"
                  + " with search_metadata (entityType='user' or 'team') and use the 'name' it"
                  + " returns.",
              paramName, missing));
    }
    return resolved;
  }

  /**
   * The current owners whose names the caller named, for removals.
   *
   * <p>Removal must not go through {@link #requireTeamsOrUsers}: an owner who has been deleted no
   * longer resolves, so requiring resolution would make the stale reference a caller most wants to
   * clear the one they cannot. Matching what the entity already holds needs no directory lookup.
   */
  public static List<EntityReference> matchOwnersByName(
      Object owners, List<EntityReference> existing) {
    Set<String> wanted =
        JsonUtils.readOrConvertValues(owners, String.class).stream()
            .map(CommonUtils::comparableName)
            .collect(Collectors.toSet());
    return existing == null
        ? List.of()
        : existing.stream().filter(ref -> wanted.contains(comparableName(ref.getName()))).toList();
  }

  /** Owner names are compared case-insensitively and unquoted, so {@code "a.b"} matches {@code a.b}. */
  private static String comparableName(String name) {
    String result = name == null ? "" : name.trim();
    if (result.length() > 1 && result.charAt(0) == '"' && result.endsWith("\"")) {
      result = result.substring(1, result.length() - 1);
    }
    return result.toLowerCase(Locale.ROOT);
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
   * Adds an {@link MetadataOperation#EDIT_ALL} check against the entity that already exists at this
   * fully qualified name, on top of the CREATE check the calling tool has already performed.
   *
   * <p>The {@code create_*} tools authorize CREATE against a {@code CreateResourceContext} for the
   * new entity and may call {@code EntityRepository.createOrUpdate}, which updates in place when the
   * name is taken. A caller holding Create but not Edit could therefore overwrite an entity owned by
   * somebody else, discarding its description, owners and tags. This closes that gap.
   *
   * <p>Note this is deliberately <em>stricter</em> than REST rather than identical to it. {@code
   * EntityResource.createOrUpdate} branches exclusively — CREATE plus the create quota for a new
   * entity, EDIT_ALL alone for an update — whereas here the overwrite leg requires both. Branching
   * exclusively would mean deciding create-vs-update before the CREATE check, and the fully qualified
   * name is not reliably known that early: several repositories build it from references that {@code
   * prepare} resolves (see {@code TagRepository.setFullyQualifiedName}, which reads the resolved
   * classification). Requiring create rights on a tool named {@code create_*} is the safer side to
   * err on; the practical cost is that a caller holding only edit rights cannot use these tools to
   * update an existing entity.
   *
   * <p>Call after the name is resolved. Use the result to route a free name through {@code create}
   * and an existing one through {@code createOrUpdate}; this prevents a concurrent creator from
   * turning create-only authorization into an overwrite. The existence lookup uses {@link
   * Include#ALL} because {@code createOrUpdate} restores a soft-deleted entity.
   *
   * @param entityType the entity type being written, e.g. {@link Entity#TAG}
   * @param entity the entity carrying the resolved fully qualified name
   * @return whether an entity exists under the resolved name
   */
  public static boolean authorizeOverwrite(
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
    return overwritesExisting;
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
