package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.util.JsonUtils;

public class ClassificationIndex implements ElasticSearchIndex {
  Classification classification;

  public ClassificationIndex(Classification classification) {
    this.classification = classification;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(classification);
    return doc;
  }
}
