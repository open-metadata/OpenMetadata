package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record StorageServiceIndex(StorageService storageService) implements SearchIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(storageService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(storageService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(storageService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            storageService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.STORAGE_SERVICE);
    doc.put("owner", getEntityWithDisplayName(storageService.getOwner()));
    return doc;
  }
}
