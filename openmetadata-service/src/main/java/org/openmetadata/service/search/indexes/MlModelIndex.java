package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.service.Entity;

public class MlModelIndex implements DataAssetIndex {
  final MlModel mlModel;

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  @Override
  public Object getEntity() {
    return mlModel;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.MLMODEL;
  }

  @Override
  public Object getIndexServiceType() {
    return mlModel.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("mlFeatures.name", 8.0f);
    fields.put("mlFeatures.description", 1.0f);
    return fields;
  }
}
