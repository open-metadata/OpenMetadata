package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class StoredProcedureIndex implements ElasticSearchIndex {

  private static final List<String> excludeFields = List.of("changeDescription");

  final StoredProcedure storedProcedure;

  public StoredProcedureIndex(StoredProcedure storedProcedure) {
    this.storedProcedure = storedProcedure;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(storedProcedure);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
