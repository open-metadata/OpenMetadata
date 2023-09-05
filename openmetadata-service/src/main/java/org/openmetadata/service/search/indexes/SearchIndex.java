package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.service.util.JsonUtils;

public class SearchIndex implements ElasticSearchIndex {

  final org.openmetadata.schema.entity.data.SearchIndex searchIndex;

  public SearchIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex) {
    this.searchIndex = searchIndex;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(searchIndex);
    return doc;
  }
}
