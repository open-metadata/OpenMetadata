package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record ClassificationIndex(Classification classification) implements SearchIndex {

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(classification.getName()).weight(10).build());
    suggest.add(
        SearchSuggest.builder().input(classification.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return classification;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(classification, Entity.CLASSIFICATION);
    esDoc.putAll(commonAttributes);
    return esDoc;
  }
}
