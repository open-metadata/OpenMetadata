package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.QueryCostRecord;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.ParseTags;

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
      query.setChangeDescription(null);
      query.setIncrementalChangeDescription(null);
      doc.put("query", query);
      doc.put("service", query.getService());
      putAccessFields(doc, query);
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

  static void putAccessFields(Map<String, Object> doc, Query query) {
    // Lift the query's access-control fields to the top level so search RBAC, which matches
    // top-level owners/tags/domains, hides a cost record exactly as it hides the query. Without a
    // top-level domain, hasDomain() treats the record as domainless and shows it to everyone.
    doc.put("owners", query.getOwners());
    final ParseTags tags = new ParseTags(listOrEmpty(query.getTags()));
    doc.put("tags", tags.getTags());
    doc.put("tier", tags.getTierTag());
    doc.put("domains", query.getDomains());
  }

  @Override
  public Object getEntity() {
    return queryCostRecord;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.QUERY_COST_RECORD;
  }
}
