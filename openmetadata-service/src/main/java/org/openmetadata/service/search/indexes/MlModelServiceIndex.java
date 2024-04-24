package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public record MlModelServiceIndex(MlModelService mlModelService) implements SearchIndex {
  private static final List<String> excludeFields = List.of("changeDescription");

  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(mlModelService.getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(mlModelService.getFullyQualifiedName()).weight(5).build());
    return suggest;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(mlModelService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(mlModelService, Entity.MLMODEL_SERVICE);
    doc.putAll(commonAttributes);
    return doc;
  }
}
