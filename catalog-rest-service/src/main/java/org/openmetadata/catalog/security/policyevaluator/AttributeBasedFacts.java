package org.openmetadata.catalog.security.policyevaluator;

import java.lang.reflect.InvocationTargetException;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.TagLabel;

@Slf4j
@Builder(setterPrefix = "with")
class AttributeBasedFacts {

  private User user;
  private Object entity;
  private MetadataOperation operation;

  // Do not allow anything external or the builder itself change the value of facts.
  // Individual Fact(s) within facts may be changed by the RulesEngine.
  private final Facts facts = new Facts();

  /**
   * Creates {@link Facts} with the operation, user (subject) and entity (object) attributes so that it is recognizable
   * by {@link org.jeasy.rules.api.RulesEngine}
   */
  public Facts getFacts() throws RuntimeException {
    if (!validate()) {
      throw new RuntimeException("Validation failed while building facts");
    }
    facts.put(CommonFields.USER_ROLES, getUserRoles(user));
    facts.put(CommonFields.ENTITY_TAGS, getEntityTags(entity));
    facts.put(CommonFields.ENTITY_TYPE, getEntityType(entity));
    facts.put(CommonFields.OPERATION, operation);
    facts.put(CommonFields.ALLOW, CommonFields.DEFAULT_ACCESS);
    log.debug("Generated facts successfully - {}", facts);
    return facts;
  }

  public boolean hasPermission() {
    return facts.get(CommonFields.ALLOW);
  }

  private List<String> getUserRoles(User user) {
    // TODO: Fix this to fetch user's roles when roles is added as entity reference list from user schema.
    return user.getTeams().stream().map(EntityReference::getName).collect(Collectors.toList());
  }

  private List<String> getEntityTags(Object entity) {
    // TODO: Fix the entityType fetch such that it is fetched from Repository or using a Util.
    // This is done here now to facilitate prototyping and unit testing.
    List<TagLabel> entityTags = Collections.emptyList();
    try {
      entityTags = (List<TagLabel>) entity.getClass().getMethod("getTags").invoke(entity);
    } catch (InvocationTargetException | IllegalAccessException | NoSuchMethodException e) {
      log.warn("Could not obtain tags for entity with class {}", entity.getClass());
    }
    return entityTags.stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
  }

  private static String getEntityType(Object object) {
    // TODO: Fix the entityType fetch such that it is fetched from Repository or using a Util.
    // This is done here now to facilitate prototyping and unit testing.
    return object.getClass().getSimpleName().toLowerCase(Locale.ROOT);
  }

  private boolean validate() {
    log.debug(
        "Validating attribute based facts - user: {}, entity: {}, operation: {}",
        this.user,
        this.entity,
        this.operation);
    return this.user != null && this.entity != null && this.operation != null;
  }
}
