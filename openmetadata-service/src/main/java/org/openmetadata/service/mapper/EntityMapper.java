package org.openmetadata.service.mapper;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.jdbi3.EntityRepository.validateOwners;
import static org.openmetadata.service.jdbi3.EntityRepository.validateReviewers;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.util.List;
import java.util.UUID;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rules.RuleEngine;

public interface EntityMapper<T extends EntityInterface, C extends CreateEntity> {
  T createToEntity(C create, String user);

  default T copy(T entity, CreateEntity request, String updatedBy) {
    List<EntityReference> owners = validateOwners(request.getOwners());
    EntityReference domain = validateDomain(request.getDomain());
    validateReviewers(request.getReviewers());
    entity.setId(UUID.randomUUID());
    entity.setName(request.getName());
    entity.setDisplayName(request.getDisplayName());
    entity.setDescription(request.getDescription());
    entity.setOwners(owners);
    entity.setDomain(domain);
    entity.setTags(request.getTags());
    entity.setDataProducts(getEntityReferences(Entity.DATA_PRODUCT, request.getDataProducts()));
    entity.setLifeCycle(request.getLifeCycle());
    entity.setExtension(request.getExtension());
    entity.setUpdatedBy(updatedBy);
    entity.setUpdatedAt(System.currentTimeMillis());
    entity.setReviewers(request.getReviewers());

    RuleEngine.getInstance().evaluate(entity);
    return entity;
  }

  default EntityReference validateDomain(String domainFqn) {
    if (CommonUtil.nullOrEmpty(domainFqn)) {
      return null;
    }
    return Entity.getEntityReferenceByName(Entity.DOMAIN, domainFqn, NON_DELETED);
  }
}
