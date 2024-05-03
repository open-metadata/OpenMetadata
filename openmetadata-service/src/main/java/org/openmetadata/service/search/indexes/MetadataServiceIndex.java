package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record MetadataServiceIndex(MetadataService metadataService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return metadataService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(metadataService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(metadataService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            metadataService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.METADATA_SERVICE);
    doc.put("owner", getEntityWithDisplayName(metadataService.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(metadataService.getFollowers()));
    return doc;
  }
}
