package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.service.Entity;

public record ClassificationIndex(Classification classification) implements SearchIndex {

  @Override
  public Object getEntity() {
    return classification;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.CLASSIFICATION;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
    return esDoc;
  }
}
