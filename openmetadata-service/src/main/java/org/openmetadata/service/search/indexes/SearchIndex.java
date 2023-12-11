package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

public interface SearchIndex {
  Map<String, Object> buildESDoc();

  default Set<String> getFQNParts(String fqn, List<String> fqnSplits) {
    Set<String> fqnParts = new HashSet<>();
    fqnParts.add(fqn);
    String parent = FullyQualifiedName.getParentFQN(fqn);
    while (parent != null) {
      fqnParts.add(parent);
      parent = FullyQualifiedName.getParentFQN(parent);
    }
    fqnParts.addAll(fqnSplits);
    return fqnParts;
  }

  default EntityReference getEntityWithDisplayName(EntityReference entity) {
    if (entity == null) {
      return null;
    }
    EntityReference cloneEntity = JsonUtils.deepCopy(entity, EntityReference.class);
    cloneEntity.setDisplayName(
        CommonUtil.nullOrEmpty(cloneEntity.getDisplayName()) ? cloneEntity.getName() : cloneEntity.getDisplayName());
    return cloneEntity;
  }

  static Map<String, Float> getDefaultFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put(FULLY_QUALIFIED_NAME, 10.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 10.0f);
    return fields;
  }

  static Map<String, Float> getAllFields() {
    Map<String, Float> fields = getDefaultFields();
    fields.putAll(TableIndex.getFields());
    fields.putAll(DashboardIndex.getFields());
    fields.putAll(DashboardDataModelIndex.getFields());
    fields.putAll(PipelineIndex.getFields());
    fields.putAll(TopicIndex.getFields());
    fields.putAll(MlModelIndex.getFields());
    fields.putAll(ContainerIndex.getFields());
    fields.putAll(SearchEntityIndex.getFields());
    fields.putAll(GlossaryTermIndex.getFields());
    fields.putAll(TagIndex.getFields());
    fields.putAll(DataProductIndex.getFields());
    return fields;
  }
}
