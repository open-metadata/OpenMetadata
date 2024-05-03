package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record DatabaseServiceIndex(DatabaseService databaseService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return databaseService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(databaseService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(databaseService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            databaseService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DATABASE_SERVICE);
    doc.put("owner", getEntityWithDisplayName(databaseService.getOwner()));
    doc.put("domain", getEntityWithDisplayName(databaseService.getDomain()));
    doc.put("followers", SearchIndexUtils.parseFollowers(databaseService.getFollowers()));
    return doc;
  }
}
