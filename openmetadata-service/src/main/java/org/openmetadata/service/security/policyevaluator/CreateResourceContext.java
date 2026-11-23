package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
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
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
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
public class CreateResourceContext<T extends EntityInterface<?>>
    implements ResourceContextInterface {
  @NonNull @Getter private final String resource;
  private final EntityRepository<T> entityRepository;
  private final T entity; // Entity being created
  private List<EntityInterface<?>> parentEntities;
  // Resolved on first use by a service condition; the flag is separate because "no service" is a
  // valid null result.
  private EntityInterface<?> serviceEntity;
  private boolean serviceEntityLoaded;

  public CreateResourceContext(@NonNull String resource, @NotNull T entity) {
    this.resource = resource;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
    this.entity = entity;
    setParents(entity);
  }

  /** For an entity whose parents are not all stored yet (e.g. created by earlier import rows). */
  public CreateResourceContext(
      @NonNull String resource,
      @NotNull T entity,
      @NonNull List<? extends EntityInterface<?>> parents) {
    this.resource = resource;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
    this.entity = entity;
    this.parentEntities = List.copyOf(parents);
  }

  @Override
  public List<EntityReference> getOwners() {
    if (nullOrEmpty(parentEntities)) {
      return null;
    }
    List<EntityReference> owners = new ArrayList<>();
    for (EntityInterface<?> parent : parentEntities) {
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
    for (EntityInterface<?> parent : parentEntities) {
      if (parent.getTags() != null) {
        tags.addAll(Entity.getEntityTags(parent.getEntityReference().getType(), parent));
      }
    }
    tags.addAll(Entity.getEntityTags(getResource(), entity));
    return getUniqueTags(tags);
  }

  @Override
  public EntityInterface<?> getEntity() {
    return entity;
  }

  @Override
  public List<EntityReference> getDomains() {
    List<EntityReference> domains = new ArrayList<>();

    // Add assigned domains at the time of entity creation
    if (entity != null && !nullOrEmpty(entity.getDomains())) {
      domains.addAll(entity.getDomains());
    }

    // Add inherited domains from parent entities
    if (!nullOrEmpty(parentEntities)) {
      for (EntityInterface<?> parent : parentEntities) {
        if (parent.getDomains() != null) {
          domains = mergedInheritedEntityRefs(domains, parent.getDomains());
        }
      }
    }
    return domains;
  }

  /**
   * The domains of the persisted parents the entity is created in. A parent that is itself a
   * domain counts as its own domain, as {@link ResourceContext#getDomains()} has it.
   */
  public List<EntityReference> getContainerDomains() {
    List<EntityReference> domains = new ArrayList<>();
    for (EntityInterface<?> parent : listOrEmpty(parentEntities)) {
      EntityReference parentReference = parent.getEntityReference();
      if (parentReference != null && Entity.DOMAIN.equals(parentReference.getType())) {
        domains = mergedInheritedEntityRefs(domains, List.of(parentReference));
      } else if (parent.getDomains() != null) {
        domains = mergedInheritedEntityRefs(domains, parent.getDomains());
      }
    }
    return domains;
  }

  /** The domains the create request names for the entity itself. */
  public List<EntityReference> getRequestedDomains() {
    return entity == null ? List.of() : listOrEmpty(entity.getDomains());
  }

  /**
   * Resolves the service from the persisted parent, never from the entity being created.
   *
   * <p>On CREATE the entity is caller-supplied, and its {@code service} is an unvalidated stub:
   * {@code EntityUtil.getEntityReference} builds it from a fully qualified name with no id and no
   * existence check, and most mappers never populate it at all ({@code TableMapper} sets only
   * {@code databaseSchema}), which would leave a create into a hidden service authorized. The
   * parent loaded by {@link #setParents} is persisted and carries the authoritative reference,
   * since every service-backed repository populates {@code service} in its own {@code setFields}.
   * Same reasoning as {@code RuleEvaluator#isReviewer} refusing this context outright.
   */
  @Override
  public EntityReference getServiceReference() {
    if (nullOrEmpty(parentEntities)) {
      return null;
    }
    List<String> serviceEntityTypes = Entity.getServiceEntityTypes();
    for (EntityInterface<?> parent : parentEntities) {
      EntityReference parentReference = parent.getEntityReference();
      if (parentReference != null && serviceEntityTypes.contains(parentReference.getType())) {
        return parentReference; // the parent is the service itself
      }
      if (parent.getService() != null) {
        return parent.getService();
      }
    }
    return null;
  }

  /**
   * Tags of the resolved service. Read separately from {@link #getTags()}, which already merges the
   * direct parent's tags into the created entity's own — that covers one level of the hierarchy,
   * not the service at its root.
   */
  @Override
  public List<TagLabel> getServiceTags() {
    EntityInterface<?> service = getServiceEntity();
    if (service == null) {
      return Collections.emptyList();
    }
    return Entity.getEntityTags(service.getEntityReference().getType(), service);
  }

  @Override
  public String getServiceType() {
    return ServiceAttributeUtil.serviceTypeOf(getServiceEntity());
  }

  @Override
  public String getServiceEnvironment() {
    return ServiceAttributeUtil.environmentOf(getServiceEntity());
  }

  /**
   * The persisted service, resolved once for every service attribute a condition reads. {@code
   * getEntityOrNull} rather than {@code getEntity} so a service deleted between the parent load and
   * this read does not raise from inside the authorization decision.
   */
  private EntityInterface<?> getServiceEntity() {
    if (!serviceEntityLoaded) {
      serviceEntity = Entity.getEntityOrNull(getServiceReference(), Entity.FIELD_TAGS, Include.ALL);
      serviceEntityLoaded = true;
    }
    return serviceEntity;
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
    EntityInterface<?> directParent;
    try {
      // First, check direct parent, which are always singular
      directParent = entityRepository.getParentEntity(entity, fields.toString());
    } catch (EntityNotFoundException e) {
      // The create fails when the repository validates the missing parent.
      directParent = null;
    }
    parentEntities =
        directParent != null
            ? List.of(directParent)
            : resolveRootParentEntities(entity, fields); // root-level parent
  }

  /**
   * The root parents named by the entity. A reference without an id is loaded by name, and one that
   * cannot be loaded fails the request: skipping it would authorize the create as if the entity had
   * no parent (ADR:2026-11-03-a-create-is-authorized-against-its-stored-container).
   */
  private List<EntityInterface<?>> resolveRootParentEntities(T entity, Fields fields) {
    List<EntityReference> rootReferences =
        switch (resource) {
          case Entity.GLOSSARY_TERM -> List.of(((GlossaryTerm) entity).getGlossary());
          case Entity.TAG -> List.of(((Tag) entity).getClassification());
          case Entity.DATA_PRODUCT -> entity.getDomains();
          case Entity.TEAM -> ((Team) entity).getParents();
          default -> null;
        };

    if (nullOrEmpty(rootReferences)) return null;
    List<EntityInterface<?>> parentEntities = new ArrayList<>();

    for (EntityReference rootReference : rootReferences) {
      if (rootReference == null) {
        continue;
      }
      EntityRepository<?> rootRepository = Entity.getEntityRepository(rootReference.getType());
      if (rootReference.getId() != null) {
        parentEntities.add(rootRepository.get(null, rootReference.getId(), fields));
      } else if (rootReference.getFullyQualifiedName() != null) {
        parentEntities.add(
            rootRepository.getByName(null, rootReference.getFullyQualifiedName(), fields));
      } else {
        throw new IllegalArgumentException(
            "A " + rootReference.getType() + " reference needs an id or a name");
      }
    }
    return parentEntities;
  }
}
