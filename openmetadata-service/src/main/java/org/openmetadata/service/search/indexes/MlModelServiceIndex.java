package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.SearchSuggest;

public record MlModelServiceIndex(MlModelService mlModelService) implements SearchIndex {

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(mlModelService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(mlModelService.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(mlModelService, Entity.MLMODEL_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("upstreamLineage", SearchIndex.getLineageData(mlModelService.getEntityReference()));
    return doc;
  }

  @Override
  public Object getEntity() {
    return mlModelService;
  }
}
