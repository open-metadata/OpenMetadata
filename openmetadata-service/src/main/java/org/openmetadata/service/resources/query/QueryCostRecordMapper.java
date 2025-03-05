package org.openmetadata.service.resources.query;

import org.openmetadata.schema.entity.data.CreateQueryCostRecord;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityTimeSeriesMapper;

public class QueryCostRecordMapper
    implements EntityTimeSeriesMapper<QueryCostRecord, CreateQueryCostRecord> {
  @Override
  public QueryCostRecord createToEntity(CreateQueryCostRecord create, String user) {
    Query query =
        Entity.getEntity(Entity.QUERY, create.getQueryReference().getId(), null, Include.ALL);
    User userEntity = Entity.getEntityByName(Entity.USER, user, null, Include.ALL);

    return new QueryCostRecord()
        .withTimestamp(create.getTimestamp())
        .withCost(create.getCost())
        .withCount(create.getCount())
        .withTotalDuration(create.getTotalDuration())
        .withUpdatedAt(System.currentTimeMillis())
        .withUpdatedBy(userEntity.getEntityReference())
        .withQueryReference(query.getEntityReference());
  }
}
