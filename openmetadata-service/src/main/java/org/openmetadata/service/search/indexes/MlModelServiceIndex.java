package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.Entity;

public record MlModelServiceIndex(MlModelService mlModelService)
    implements TaggableIndex, LineageIndex {

  @Override
  public Object getEntity() {
    return mlModelService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.MLMODEL_SERVICE;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
