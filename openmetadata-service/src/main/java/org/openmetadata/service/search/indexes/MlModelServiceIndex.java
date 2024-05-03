package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record MlModelServiceIndex(MlModelService mlModelService) implements SearchIndex {

  @Override
  public Object getEntity() {
    return mlModelService;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(mlModelService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(mlModelService.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            mlModelService.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MLMODEL_SERVICE);
    doc.put("owner", getEntityWithDisplayName(mlModelService.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(mlModelService.getFollowers()));
    return doc;
  }
}
