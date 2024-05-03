package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record SearchServiceIndex(SearchService searchService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return searchService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(searchService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(searchService.getFullyQualifiedName()).weight(5).build());
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.SEARCH_SERVICE);
    doc.put(
        "fqnParts",
        getFQNParts(
            searchService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("owner", getEntityWithDisplayName(searchService.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(searchService.getFollowers()));
    return doc;
  }
}
