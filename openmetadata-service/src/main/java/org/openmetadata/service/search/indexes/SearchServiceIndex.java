package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class SearchServiceIndex implements ElasticSearchIndex {

  final SearchService searchService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public SearchServiceIndex(SearchService searchService) {
    this.searchService = searchService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(searchService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
