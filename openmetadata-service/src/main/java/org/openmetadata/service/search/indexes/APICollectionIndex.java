package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record APICollectionIndex(APICollection apiCollection) implements SearchIndex {
  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(apiCollection.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(apiCollection.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  @Override
  public Object getEntity() {
    return apiCollection;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(apiCollection, Entity.API_COLLCECTION);
    doc.putAll(commonAttributes);
    return doc;
  }
}
