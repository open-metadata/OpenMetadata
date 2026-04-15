package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.QUERY;
import static org.openmetadata.service.search.EntityBuilderConstant.QUERY_NGRAM;

import java.util.Map;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.service.Entity;

public class QueryIndex implements TaggableIndex {
  final Query query;

  public QueryIndex(Query query) {
    this.query = query;
  }

  @Override
  public Object getEntity() {
    return query;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.QUERY;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put(QUERY, 10.0f);
    fields.put(QUERY_NGRAM, 1.0f);
    return fields;
  }
}
