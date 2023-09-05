package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.util.JsonUtils;

public class MlModelServiceIndex implements ElasticSearchIndex {

  final MlModelService mlModelService;

  public MlModelServiceIndex(MlModelService mlModelService) {
    this.mlModelService = mlModelService;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(mlModelService);
    return doc;
  }
}
