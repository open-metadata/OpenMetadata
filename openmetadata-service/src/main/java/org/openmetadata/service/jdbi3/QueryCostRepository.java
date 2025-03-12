package org.openmetadata.service.jdbi3;

import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryCostResource;

public class QueryCostRepository extends EntityTimeSeriesRepository<QueryCostRecord> {

  public QueryCostRepository() {
    super(
        QueryCostResource.COLLECTION_PATH,
        Entity.getCollectionDAO().queryCostRecordTimeSeriesDAO(),
        QueryCostRecord.class,
        Entity.QUERY_COST_RECORD);
  }
}
