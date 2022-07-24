package org.openmetadata.catalog.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.util.JsonUtils;

public class MlModelIndex {
  MlModel mlModel;

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(mlModel);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    suggest.add(ElasticSearchSuggest.builder().input(mlModel.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(mlModel.getName()).weight(10).build());

    ParseTags parseTags = new ParseTags(ElasticSearchIndexUtils.parseTags(mlModel.getTags()));
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(mlModel.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MLMODEL);
    doc.put("serviceType", mlModel.getServiceType());
    return doc;
  }
}
