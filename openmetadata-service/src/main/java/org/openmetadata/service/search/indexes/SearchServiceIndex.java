package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.service.util.JsonUtils;

public class SearchServiceIndex implements ElasticSearchIndex {

  final SearchService searchService;

  public SearchServiceIndex(SearchService searchService) {
    this.searchService = searchService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(searchService);
    return doc;
  }
}
