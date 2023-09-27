package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class SearchServiceIndex implements ElasticSearchIndex {

  final SearchService searchService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public SearchServiceIndex(SearchService searchService) {
    this.searchService = searchService;
  }

  public Map<String, Object> buildESDoc() {
    if (searchService.getOwner() != null) {
      EntityReference owner = searchService.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      searchService.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(searchService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(searchService.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(searchService.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.SEARCH_SERVICE);
    doc.put(
        "fqnParts",
        getFQNParts(
            searchService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    return doc;
  }
}
