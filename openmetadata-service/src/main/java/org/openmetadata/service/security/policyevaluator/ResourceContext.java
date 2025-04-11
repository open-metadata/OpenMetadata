package org.openmetadata.service.security.policyevaluator;

import com.google.common.annotations.VisibleForTesting;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NonNull;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Builds ResourceContext lazily. ResourceContext includes all the attributes of a resource a user is trying to access
 * to be used for evaluating Access Control policies.
 *
 * <p>As multiple threads don't access this, the class is not thread-safe by design.
 */
public class ResourceContext<T extends EntityInterface> implements ResourceContextInterface {
  private static final Logger LOG = LoggerFactory.getLogger(ResourceContext.class);

  @NonNull @Getter private final String resource;
  private final EntityRepository<T> entityRepository;
  private final UUID id;
  private final String name;
  private T entity; // Will be lazily initialized
  private ResourceContextInterface.Operation operation = ResourceContextInterface.Operation.NONE;

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

  public ResourceContext(
      @NonNull String resource,
      UUID id,
      String name,
      ResourceContextInterface.Operation operation) {
    this.resource = resource;
    this.id = id;
    this.name = name;
    this.operation = operation;
    this.entityRepository = (EntityRepository<T>) Entity.getEntityRepository(resource);
  }

  @VisibleForTesting
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
    return entity.getOwners();
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
  public EntityReference getDomain() {
    resolveEntity();
    if (entity == null) {
      return null;
    } else if (Entity.DOMAIN.equals(entityRepository.getEntityType())) {
      return entity.getEntityReference(); // Domain for a domain is same as the domain
    }
    return entity.getDomain();
  }

  @Override
  public EntityReference getParent() {
    resolveEntity();
    if (entity == null) {
      return null;
    }
    return entity.getParent();
  }

  private EntityInterface resolveEntity() {
    if (entity == null) {
      Fields fieldList;
      String fields = "";
      if (operation == ResourceContextInterface.Operation.PATCH) {
        fieldList = entityRepository.getPatchFields();
      } else if (operation == ResourceContextInterface.Operation.PUT) {
        fieldList = entityRepository.getPutFields();
      } else {
        if (entityRepository.isSupportsOwners()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_OWNERS);
        }
        if (entityRepository.isSupportsTags()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_TAGS);
        }
        if (entityRepository.isSupportsDomain()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_DOMAIN);
        }
        if (entityRepository.isSupportsReviewers()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_REVIEWERS);
        }
        if (entityRepository.isSupportsDomain()) {
          fields = EntityUtil.addField(fields, Entity.FIELD_DOMAIN);
        }
        fieldList = entityRepository.getFields(fields);
      }

      try {
        if (id != null) {
          entity = entityRepository.get(null, id, fieldList, Include.ALL, true);
        } else if (name != null) {
          entity = entityRepository.getByName(null, name, fieldList, Include.ALL, true);
        }
      } catch (EntityNotFoundException e) {
        entity = null;
      }
    }
    return entity;
  }
}
