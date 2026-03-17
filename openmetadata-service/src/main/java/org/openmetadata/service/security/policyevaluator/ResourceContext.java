package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Builds ResourceContext lazily. ResourceContext includes all the attributes of a resource a user is trying to access
 * to be used for evaluating Access Control policies.
 *
 * <p>As multiple threads don't access this, the class is not thread-safe by design.
 */
@Slf4j
public class ResourceContext<T extends EntityInterface> implements ResourceContextInterface {
  @NonNull @Getter private final String resource;
  private final EntityRepository<T> entityRepository;
  private final UUID id;
  private final String name;
  private T entity; // Will be lazily initialized
  private ResourceContextInterface.Operation operation = ResourceContextInterface.Operation.NONE;
  private Include include;
  private Fields requestedFields;
  private RelationIncludes relationIncludes;

  public ResourceContext(@NonNull String resource) {
    this.resource = resource;
    this.id = null;
    this.name = null;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
  }

  public ResourceContext(@NonNull String resource, UUID id, String name) {
    this.resource = resource;
    this.id = id;
    this.name = name;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
  }

  public ResourceContext(@NonNull String resource, UUID id, String name, Include include) {
    this.resource = resource;
    this.id = id;
    this.name = name;
    this.include = include;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
  }

  public ResourceContext(
      @NonNull String resource,
      UUID id,
      String name,
      Include include,
      Fields requestedFields,
      RelationIncludes relationIncludes) {
    this.resource = resource;
    this.id = id;
    this.name = name;
    this.include = include;
    this.requestedFields = requestedFields;
    this.relationIncludes = relationIncludes;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
  }

  public ResourceContext(
      @NonNull String resource,
      UUID id,
      String name,
      ResourceContextInterface.Operation operation) {
    this(resource, id, name, operation, null);
  }

  public ResourceContext(
      @NonNull String resource,
      UUID id,
      String name,
      ResourceContextInterface.Operation operation,
      Include include) {
    this.resource = resource;
    this.id = id;
    this.name = name;
    this.operation = operation;
    this.include = include;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
  }

  public ResourceContext(@NonNull String resource, T entity, EntityRepository<T> repository) {
    this.resource = resource;
    this.id = null;
    this.name = null;
    this.entity = entity;
    this.entityRepository = repository;
  }

  @Override
  public List<EntityReference> getOwners() {
    resolveEntity();
    if (entity == null) {
      return null;
    } else if (Entity.USER.equals(entityRepository.getEntityType())) {
      return List.of(entity.getEntityReference()); // Owner for a user is same as the user
    }

    // Check for parents owners'
    List<EntityReference> owners =
        nullOrEmpty(entity.getOwners()) ? null : new ArrayList<>(entity.getOwners());
    List<EntityInterface> parentEntities = resolveParentEntities(entity);
    if (!nullOrEmpty(parentEntities)) {
      for (EntityInterface parentEntity : parentEntities) {
        if (parentEntity.getOwners() != null) {
          if (owners == null) owners = new ArrayList<>();
          owners.addAll(parentEntity.getOwners());
        }
      }
    }

    return owners;
  }

  private List<EntityInterface> resolveParentEntities(T entity) {
    Fields fields = new Fields(new HashSet<>(Collections.singleton(FIELD_OWNERS)));
    try {
      List<EntityReference> parentReferences =
          switch (entityRepository.getEntityType()) {
            case Entity.GLOSSARY_TERM -> List.of(((GlossaryTerm) entity).getGlossary());
            case Entity.TAG -> List.of(((Tag) entity).getClassification());
            case Entity.DATA_PRODUCT -> entity.getDomains();
            default -> null;
          };

      if (nullOrEmpty(parentReferences)) return null;
      List<EntityInterface> parentEntities = new ArrayList<>();

      for (EntityReference parentReference : parentReferences) {
        if (parentReference == null || parentReference.getId() == null) {
          LOG.warn("Parent reference is null or does not have an ID: {}", parentReference);
          continue;
        }
        EntityRepository<?> rootRepository = Entity.getEntityRepository(parentReference.getType());
        parentEntities.add(rootRepository.get(null, parentReference.getId(), fields));
      }
      return parentEntities;
    } catch (Exception e) {
      LOG.error("Failed to resolve parent entity: {}", e.getMessage(), e);
      return null;
    }
  }

  @Override
  public List<TagLabel> getTags() {
    resolveEntity();
    return entity == null ? Collections.emptyList() : Entity.getEntityTags(getResource(), entity);
  }

  @Override
  public EntityInterface getEntity() {
    return resolveEntity();
  }

  @Override
  public List<EntityReference> getDomains() {
    resolveEntity();
    if (entity == null) {
      return null;
    } else if (Entity.DOMAIN.equals(entityRepository.getEntityType())) {
      return List.of(entity.getEntityReference()); // Domain for a domain is same as the domain
    }
    return entity.getDomains();
  }

  private EntityInterface resolveEntity() {
    if (entity == null) {
      Fields fieldList;
      String fields = "";
      RelationIncludes relationIncludesToUse = relationIncludes;
      if (operation == ResourceContextInterface.Operation.PATCH) {
        fieldList = entityRepository.getPatchFields();
      } else if (operation == ResourceContextInterface.Operation.PUT) {
        fieldList = entityRepository.getPutFields();
      } else if (requestedFields != null) {
        fieldList = requestedFields;
      } else {
        if (entityRepository.isSupportsOwners()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_OWNERS);
        }
        if (entityRepository.isSupportsTags()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_TAGS);
        }
        if (entityRepository.isSupportsDomains()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_DOMAINS);
        }
        if (entityRepository.isSupportsReviewers()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_REVIEWERS);
        }
        fieldList = entityRepository.getFields(fields);
      }

      Include includeToUse = resolveInclude();
      boolean fromCache = useRepositoryCache();
      if (relationIncludesToUse == null) {
        relationIncludesToUse = RelationIncludes.fromInclude(includeToUse);
      }

      try {
        if (id != null) {
          entity = entityRepository.get(null, id, fieldList, relationIncludesToUse, fromCache);
        } else if (name != null) {
          entity =
              entityRepository.getByName(null, name, fieldList, relationIncludesToUse, fromCache);
        }
      } catch (EntityNotFoundException e) {
        entity = null;
      }
    }
    return entity;
  }

  private Include resolveInclude() {
    if (operation == ResourceContextInterface.Operation.PATCH
        || operation == ResourceContextInterface.Operation.PUT) {
      return Include.NON_DELETED;
    }
    if (operation == ResourceContextInterface.Operation.DELETE) {
      return Include.ALL;
    }
    return include != null ? include : Include.ALL;
  }

  private boolean useRepositoryCache() {
    if (requestedFields != null) {
      return false;
    }
    return operation != ResourceContextInterface.Operation.PATCH
        && operation != ResourceContextInterface.Operation.PUT;
  }
}
