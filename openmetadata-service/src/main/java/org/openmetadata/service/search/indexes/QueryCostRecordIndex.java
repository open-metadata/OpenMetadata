package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

public class QueryCostRecordIndex implements SearchIndex {
  final QueryCostRecord queryCostRecord;

  public QueryCostRecordIndex(QueryCostRecord queryCostRecord) {
    this.queryCostRecord = queryCostRecord;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    EntityReference queryReference = queryCostRecord.getQueryReference();
    Query query = Entity.getEntity(queryReference, "*", Include.NON_DELETED);
    doc.put("query", query);
    doc.put("service", query.getService());
    doc.put("cost", queryCostRecord.getCost());
    doc.put("count", queryCostRecord.getCount());
    doc.put("timestamp", queryCostRecord.getTimestamp());
    doc.put("@timestamp", queryCostRecord.getTimestamp());
    doc.put("totalDuration", queryCostRecord.getTotalDuration());
    return doc;
  }

  @Override
  public Object getEntity() {
    return queryCostRecord;
  }
}
