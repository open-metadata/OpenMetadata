package org.openmetadata.catalog.security.policyevaluator;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import lombok.Builder;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.jeasy.rules.api.Facts;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MetadataOperation;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;

@Slf4j
@Builder(setterPrefix = "with")
class AttributeBasedFacts {

  @NonNull private User user;
  @NonNull private Object entity;
  @NonNull private MetadataOperation operation;

  // Do not allow anything external or the builder itself change the value of facts.
  // Individual Fact(s) within facts may be changed by the RulesEngine.
  private final Facts facts = new Facts();

  /**
   * Creates {@link Facts} with the operation, user (subject) and entity (object) attributes so that it is recognizable
   * by {@link org.jeasy.rules.api.RulesEngine}
   */
  public Facts getFacts() {
    facts.put(CommonFields.USER_ROLES, getUserRoles(user));
    facts.put(CommonFields.ENTITY_TAGS, getEntityTags(entity));
    facts.put(CommonFields.ENTITY_TYPE, getEntityType(entity));
    facts.put(CommonFields.OPERATION, operation);
    facts.put(CommonFields.ALLOW, CommonFields.DEFAULT_ACCESS);
    LOG.debug("Generated facts successfully - {}", facts);
    return facts;
  }

  public boolean hasPermission() {
    return facts.get(CommonFields.ALLOW);
  }

  private List<String> getUserRoles(@NonNull User user) {
    return user.getRoles().stream().map(EntityReference::getName).collect(Collectors.toList());
  }

  private List<String> getEntityTags(@NonNull Object entity) {
    List<TagLabel> entityTags = null;
    try {
      EntityInterface<?> entityInterface = Entity.getEntityInterface(entity);
      entityTags = entityInterface.getTags();
    } catch (EntityNotFoundException e) {
      LOG.warn("could not obtain tags for the given entity {} - exception: {}", entity, e.toString());
    }
    if (entityTags == null) {
      return Collections.emptyList();
    }
    return entityTags.stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
  }

  private static String getEntityType(@NonNull Object entity) {
    String entityType = Entity.getEntityNameFromObject(entity);
    if (entityType == null) {
      LOG.warn("could not find entity type for the given entity {}", entity);
    }
    return entityType;
  }
}
