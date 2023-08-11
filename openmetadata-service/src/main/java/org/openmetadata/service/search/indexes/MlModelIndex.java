package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class MlModelIndex implements ElasticSearchIndex {
  final MlModel mlModel;
  final List<String> excludeFields = List.of("changeDescription");

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  public Map<String, Object> buildESDoc() {
    if (mlModel.getOwner() != null) {
      EntityReference owner = mlModel.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      mlModel.setOwner(owner);
    }
    Map<String, Object> doc = JsonUtils.getMap(mlModel);
    List<SearchSuggest> suggest = new ArrayList<>();
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    suggest.add(SearchSuggest.builder().input(mlModel.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(mlModel.getName()).weight(10).build());

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.MLMODEL, mlModel));
    doc.put("displayName", mlModel.getDisplayName() != null ? mlModel.getDisplayName() : mlModel.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(mlModel.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MLMODEL);
    doc.put("serviceType", mlModel.getServiceType());
    return doc;
  }
}
