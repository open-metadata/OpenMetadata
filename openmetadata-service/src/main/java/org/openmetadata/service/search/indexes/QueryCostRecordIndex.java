package org.openmetadata.service.search.indexes;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

@Slf4j
public class QueryCostRecordIndex implements SearchIndex {
  final QueryCostRecord queryCostRecord;

  public QueryCostRecordIndex(QueryCostRecord queryCostRecord) {
    this.queryCostRecord = queryCostRecord;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    EntityReference queryReference = queryCostRecord.getQueryReference();
    try {
      Query query = Entity.getEntity(queryReference, "*", Include.NON_DELETED);
      doc.put("query", query);
      doc.put("service", query.getService());
    } catch (EntityNotFoundException ex) {
      LOG.warn(
          "Query entity [{}] not found for QueryCostRecord, skipping indexing: {}",
          queryReference != null ? queryReference.getId() : "null",
          ex.getMessage());
      throw ex;
    }
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
