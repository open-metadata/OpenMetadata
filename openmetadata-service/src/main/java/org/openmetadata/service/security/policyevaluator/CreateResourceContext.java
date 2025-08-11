package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.resources.tags.TagLabelUtil.getUniqueTags;
import static org.openmetadata.service.util.EntityUtil.mergedInheritedEntityRefs;

import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
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
  private List<EntityInterface> parentEntities;

  public CreateResourceContext(@NonNull String resource, @NotNull T entity) {
    this.resource = resource;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
    this.entity = entity;
    setParents(entity);
  }

  @Override
  public List<EntityReference> getOwners() {
    if (nullOrEmpty(parentEntities)) {
      return null;
    }
    List<EntityReference> owners = new ArrayList<>();
    for (EntityInterface parent : parentEntities) {
      if (parent.getOwners() != null) {
        owners = mergedInheritedEntityRefs(owners, parent.getOwners());
      }
    }
    return owners;
  }

  @Override
  public List<TagLabel> getTags() {
    if (nullOrEmpty(parentEntities)) {
      return Collections.emptyList();
    }
    List<TagLabel> tags = new ArrayList<>();
    for (EntityInterface parent : parentEntities) {
      if (parent.getTags() != null) {
        tags.addAll(Entity.getEntityTags(getResource(), parent));
      }
    }
    return getUniqueTags(tags);
  }

  @Override
  public EntityInterface getEntity() {
    return entity;
  }

  @Override
  public List<EntityReference> getDomains() {
    if (nullOrEmpty(parentEntities)) {
      return null;
    }
    List<EntityReference> domains = new ArrayList<>();
    for (EntityInterface parent : parentEntities) {
      if (parent.getOwners() != null) {
        domains = mergedInheritedEntityRefs(domains, parent.getDomains());
      }
    }
    return domains;
  }

  private void setParents(T entity) {
    Fields fields = new Fields(new HashSet<>());
    if (entityRepository.isSupportsOwners()) {
      fields.getFieldList().add(Entity.FIELD_OWNERS);
    }
    if (entityRepository.isSupportsTags()) {
      fields.getFieldList().add(Entity.FIELD_TAGS);
    }
    if (entityRepository.isSupportsDomains()) {
      fields.getFieldList().add(Entity.FIELD_DOMAINS);
    }
    if (entityRepository.isSupportsReviewers()) {
      fields.getFieldList().add(Entity.FIELD_REVIEWERS);
    }
    try {
      // First, check direct parent, which are always singular
      EntityInterface directParent = entityRepository.getParentEntity(entity, fields.toString());
      if (directParent == null) {
        parentEntities = null;
        return;
      }
      parentEntities = List.of(directParent);
      // If direct parent is not found, check for root-level parent
      if (nullOrEmpty(parentEntities)) {
        parentEntities = resolveRootParentEntities(entity, fields);
      }
    } catch (EntityNotFoundException e) {
      parentEntities = null;
    }
  }

  private List<EntityInterface> resolveRootParentEntities(T entity, Fields fields) {
    try {
      List<EntityReference> rootReferences =
          switch (entityRepository.getEntityType()) {
            case Entity.GLOSSARY_TERM -> List.of(((GlossaryTerm) entity).getGlossary());
            case Entity.TAG -> List.of(((Tag) entity).getClassification());
            case Entity.DATA_PRODUCT -> entity.getDomains();
            default -> null;
          };

      if (nullOrEmpty(rootReferences)) return null;
      List<EntityInterface> parentEntities = new ArrayList<>();

      for (EntityReference rootReference : rootReferences) {
        if (rootReference == null || rootReference.getId() == null) {
          LOG.warn("Root reference is null or does not have an ID: {}", rootReference);
          continue;
        }
        EntityRepository<?> rootRepository = Entity.getEntityRepository(rootReference.getType());
        parentEntities.add(rootRepository.get(null, rootReference.getId(), fields));
      }
      return parentEntities;
    } catch (Exception e) {
      LOG.error("Failed to resolve parent entity: {}", e.getMessage(), e);
      return null;
    }
  }
}
