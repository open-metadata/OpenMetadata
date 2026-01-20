package org.openmetadata.service.resources.query;

import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.jdbi3.EntityRepository.validateOwners;
import static org.openmetadata.service.jdbi3.EntityRepository.validateReviewers;
import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.CreateEntity;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.util.EntityUtil;

public class QueryMapper implements EntityMapper<Query, CreateQuery> {
  @Override
  public Query createToEntity(CreateQuery create, String user) {

    return copy(new Query(), create, user)
        .withQuery(create.getQuery())
        .withChecksum(EntityUtil.hash(create.getQuery()))
        .withService(getEntityReference(Entity.DATABASE_SERVICE, create.getService()))
        .withDuration(create.getDuration())
        .withVotes(new Votes().withUpVotes(0).withDownVotes(0))
        .withUsers(getEntityReferences(USER, create.getUsers()))
        .withQueryUsedIn(EntityUtil.validateAndPopulateEntityReferences(create.getQueryUsedIn()))
        .withQueryDate(create.getQueryDate())
        .withUsedBy(create.getUsedBy())
        .withTriggeredBy(create.getTriggeredBy())
        .withProcessedLineage(create.getProcessedLineage());
  }

  @Override
  public Query copy(Query entity, CreateEntity request, String updatedBy) {
    List<EntityReference> owners = validateOwners(request.getOwners());
    validateReviewers(request.getReviewers());
    entity.setId(UUID.randomUUID());
    entity.setName(request.getName());
    entity.setDisplayName(request.getDisplayName());
    entity.setDescription(request.getDescription());
    entity.setOwners(owners);
    entity.setDomains(null);
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
}
