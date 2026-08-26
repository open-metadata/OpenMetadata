package org.openmetadata.mcp.tools;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/** The repository-owned information needed to create one entity type. */
record EntityCreationSpec(
    String entityType,
    EntityRepository<? extends EntityInterface> repository,
    Class<? extends EntityInterface> entityClass) {

  static EntityCreationSpec resolve(String entityType) {
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return new EntityCreationSpec(entityType, repository, repository.getEntityClass());
  }

  @SuppressWarnings("unchecked")
  EntityRepository<EntityInterface> typedRepository() {
    return (EntityRepository<EntityInterface>) repository;
  }

  boolean hasMcpDefault(String field) {
    return Domain.class.equals(entityClass) && "domainType".equals(field);
  }

  boolean isMcpOwned(String field) {
    return ContextMemory.class.equals(entityClass) && "sourceType".equals(field);
  }
}
