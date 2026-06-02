package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

public record SearchEntityIndex(org.openmetadata.schema.entity.data.SearchIndex searchIndex)
    implements DataAssetIndex {

  @Override
  public Object getEntity() {
    return searchIndex;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.SEARCH_INDEX;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    doc.put("indexType", searchIndex.getIndexType());
    if (!nullOrEmpty(searchIndex.getFields())) {
      List<String> fieldsWithChildrenName = new ArrayList<>();
      flattenFieldNames(searchIndex.getFields(), null, fieldsWithChildrenName);
      doc.put("fieldNames", fieldsWithChildrenName);
      // Add flat field names for fuzzy search to avoid array-based clause multiplication
      doc.put("fieldNamesFuzzy", String.join(" ", fieldsWithChildrenName));
    }
    return doc;
  }

  private void flattenFieldNames(
      List<SearchIndexField> fields, String parentField, List<String> fieldsWithChildrenName) {
    for (SearchIndexField field : fields) {
      String fieldName =
          parentField == null
              ? field.getName()
              : FullyQualifiedName.add(parentField, field.getName());
      fieldsWithChildrenName.add(fieldName);
      if (!nullOrEmpty(field.getChildren())) {
        flattenFieldNames(field.getChildren(), field.getName(), fieldsWithChildrenName);
      }
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("fields.name", 7.0f);
    fields.put("fields.name.keyword", 50f);
    fields.put("fieldNamesFuzzy", 7.0f);
    return fields;
  }
}
