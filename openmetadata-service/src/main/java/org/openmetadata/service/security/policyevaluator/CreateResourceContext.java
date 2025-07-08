package org.openmetadata.service.security.policyevaluator;

import jakarta.validation.constraints.NotNull;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import lombok.Getter;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * ResourceContext used for CREATE operations where ownership, tags are inherited from the parent term.
 *
 * <p>As multiple threads don't access this, the class is not thread-safe by design.
 */
@Slf4j
public class CreateResourceContext<T extends EntityInterface> implements ResourceContextInterface {
  @NonNull @Getter private final String resource;
  private final EntityRepository<T> entityRepository;
  private final T entity; // Entity being created
  private EntityInterface parentEntity; // Entity being created

  public CreateResourceContext(@NonNull String resource, @NotNull T entity) {
    this.resource = resource;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
    this.entity = entity;
    setParent(entity);
  }

  @Override
  public List<EntityReference> getOwners() {
    return parentEntity == null ? null : parentEntity.getOwners();
  }

  @Override
  public List<TagLabel> getTags() {
    return parentEntity == null
        ? Collections.emptyList()
        : Entity.getEntityTags(getResource(), parentEntity);
  }

  @Override
  public EntityInterface getEntity() {
    return entity;
  }

  @Override
  public EntityReference getDomain() {
    return parentEntity == null ? null : parentEntity.getDomain();
  }

  private void setParent(T entity) {
    Fields fields = new Fields(new HashSet<>());
    if (entityRepository.isSupportsOwners()) {
      fields.getFieldList().add(Entity.FIELD_OWNERS);
    }
    if (entityRepository.isSupportsTags()) {
      fields.getFieldList().add(Entity.FIELD_TAGS);
    }
    if (entityRepository.isSupportsDomain()) {
      fields.getFieldList().add(Entity.FIELD_DOMAIN);
    }
    if (entityRepository.isSupportsReviewers()) {
      fields.getFieldList().add(Entity.FIELD_REVIEWERS);
    }
    try {
      // First, check direct parent
      parentEntity = entityRepository.getParentEntity(entity, fields.toString());
      // If direct parent is not found, check for root-level parent
      if (parentEntity == null) {
        parentEntity = resolveRootParentEntity(entity, fields);
      }
    } catch (EntityNotFoundException e) {
      parentEntity = null;
    }
  }

  private EntityInterface resolveRootParentEntity(T entity, Fields fields) {
    try {
      EntityReference rootReference =
          switch (entityRepository.getEntityType()) {
            case Entity.GLOSSARY_TERM -> ((GlossaryTerm) entity).getGlossary();
            case Entity.TAG -> ((Tag) entity).getClassification();
            case Entity.DATA_PRODUCT -> entity.getDomain();
            default -> null;
          };

      if (rootReference == null || rootReference.getId() == null) return null;
      EntityRepository<?> rootRepository = Entity.getEntityRepository(rootReference.getType());
      return rootRepository.get(null, rootReference.getId(), fields);
    } catch (Exception e) {
      LOG.error("Failed to resolve root parent entity: {}", e.getMessage(), e);
      return null;
    }
  }
}
