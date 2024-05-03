package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public record ClassificationIndex(Classification classification) implements SearchIndex {

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(classification.getName()).weight(10).build());
    suggest.add(
        SearchSuggest.builder().input(classification.getFullyQualifiedName()).weight(5).build());
    doc.put(
        "fqnParts",
        getFQNParts(
            classification.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.CLASSIFICATION);
    doc.put("owner", getEntityWithDisplayName(classification.getOwner()));
    doc.put("followers", SearchIndexUtils.parseFollowers(classification.getFollowers()));
    return doc;
  }

  @Override
  public Object getEntity() {
    return classification;
  }
}
