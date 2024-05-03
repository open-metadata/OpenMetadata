package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;

public class MlModelIndex implements SearchIndex {
  final MlModel mlModel;

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  @Override
  public Object getEntity() {
    return mlModel;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(mlModel.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(mlModel.getName()).weight(10).build());

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.MLMODEL, mlModel));
    doc.put(
        "displayName",
        mlModel.getDisplayName() != null ? mlModel.getDisplayName() : mlModel.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(mlModel.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("entityType", Entity.MLMODEL);
    doc.put("serviceType", mlModel.getServiceType());
    doc.put(
        "totalVotes",
        CommonUtil.nullOrEmpty(mlModel.getVotes())
            ? 0
            : mlModel.getVotes().getUpVotes() - mlModel.getVotes().getDownVotes());
    doc.put("lineage", SearchIndex.getLineageData(mlModel.getEntityReference()));
    doc.put(
        "fqnParts",
        getFQNParts(
            mlModel.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).toList()));
    doc.put("owner", getEntityWithDisplayName(mlModel.getOwner()));
    doc.put("service", getEntityWithDisplayName(mlModel.getService()));
    doc.put("domain", getEntityWithDisplayName(mlModel.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("mlFeatures.name", 8.0f);
    fields.put("mlFeatures.description", 1.0f);
    return fields;
  }
}
