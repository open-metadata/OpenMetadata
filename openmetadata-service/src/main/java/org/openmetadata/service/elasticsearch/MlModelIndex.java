package org.openmetadata.service.elasticsearch;

import static org.openmetadata.service.elasticsearch.ElasticSearchIndexUtils.parseTags;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class MlModelIndex implements ElasticSearchIndex {
  final MlModel mlModel;
  final List<String> excludeFields = List.of("changeDescription");

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(mlModel);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    suggest.add(ElasticSearchSuggest.builder().input(mlModel.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(mlModel.getName()).weight(10).build());

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.MLMODEL, mlModel));
    doc.put("displayName", mlModel.getDisplayName() != null ? mlModel.getDisplayName() : mlModel.getName());
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(mlModel.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MLMODEL);
    doc.put("serviceType", mlModel.getServiceType());
    return doc;
  }
}
