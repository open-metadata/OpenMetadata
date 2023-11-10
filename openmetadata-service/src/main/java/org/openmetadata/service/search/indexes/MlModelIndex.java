package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

public class MlModelIndex implements SearchIndex {
  final MlModel mlModel;
  final List<String> excludeFields = List.of("changeDescription");

  public MlModelIndex(MlModel mlModel) {
    this.mlModel = mlModel;
  }

  public Map<String, Object> buildESDoc() {
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
    doc.put(
        "fqnParts",
        getFQNParts(
            mlModel.getFullyQualifiedName(),
            suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("owner", getOwnerWithDisplayName(mlModel.getOwner()));
    doc.put("service", getServiceWithDisplayName(mlModel.getService()));
    doc.put("domain", getDomainWithDisplayName(mlModel.getDomain()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put("mlFeatures.name", 2.0f);
    fields.put("mlFeatures.description", 1.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
    return fields;
  }
}
