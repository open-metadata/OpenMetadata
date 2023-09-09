package org.openmetadata.service.search.indexes;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.JsonUtils;

public class MlModelServiceIndex implements ElasticSearchIndex {

  final MlModelService mlModelService;

  private static final List<String> excludeFields = List.of("changeDescription");

  public MlModelServiceIndex(MlModelService mlModelService) {
    this.mlModelService = mlModelService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(mlModelService);
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    return doc;
  }
}
