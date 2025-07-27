package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class MlModelIndex implements SearchIndex {
  final MlModel mlModel;

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  @Override
  public Object getEntity() {
    return mlModel;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.MLMODEL, mlModel));
    Map<String, Object> commonAttributes = getCommonAttributesMap(mlModel, Entity.MLMODEL);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("serviceType", mlModel.getServiceType());
    doc.put("upstreamLineage", SearchIndex.getLineageData(mlModel.getEntityReference()));
    doc.put("service", getEntityWithDisplayName(mlModel.getService()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("mlFeatures.name", 8.0f);
    fields.put("mlFeatures.description", 1.0f);
    return fields;
  }
}
