package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;

public record ClassificationIndex(Classification classification) implements SearchIndex {

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
