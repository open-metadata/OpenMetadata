package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class DatabaseServiceIndex implements SearchIndex {

  final DatabaseService databaseService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public DatabaseServiceIndex(DatabaseService databaseService) {
    this.databaseService = databaseService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(databaseService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(databaseService.getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(databaseService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            databaseService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.DATABASE_SERVICE);
    if (databaseService.getOwner() != null) {
      doc.put("owner", getOwnerWithDisplayName(databaseService.getOwner()));
    }
    if (databaseService.getDomain() != null) {
      doc.put("domain", getDomainWithDisplayName(databaseService.getDomain()));
    }
    return doc;
  }
}
