package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record StorageServiceIndex(StorageService storageService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return storageService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(storageService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(storageService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            storageService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.STORAGE_SERVICE);
    doc.put("owner", getEntityWithDisplayName(storageService.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(storageService.getFollowers()));
    return doc;
  }
}
