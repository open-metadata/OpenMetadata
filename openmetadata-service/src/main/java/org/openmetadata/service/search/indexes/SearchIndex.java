package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class SearchIndex implements ElasticSearchIndex {

  final org.openmetadata.schema.entity.data.SearchIndex searchIndex;

  private static final List<String> excludeFields = List.of("changeDescription");

  public SearchIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex) {
    this.searchIndex = searchIndex;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(searchIndex);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
