package org.openmetadata.service.resources.query;

import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.util.EntityUtil.getEntityReference;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
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
        .withQueryUsedIn(EntityUtil.populateEntityReferences(create.getQueryUsedIn()))
        .withQueryDate(create.getQueryDate())
        .withUsedBy(create.getUsedBy())
        .withTriggeredBy(create.getTriggeredBy())
        .withProcessedLineage(create.getProcessedLineage());
  }
}
