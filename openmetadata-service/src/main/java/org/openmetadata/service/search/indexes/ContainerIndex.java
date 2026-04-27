package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.DATA_MODEL_COLUMNS_NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;

public record ContainerIndex(Container container) implements ColumnIndex, DataAssetIndex {

  @Override
  public Object getEntity() {
    return container;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.CONTAINER;
  }

  @Override
  public Object getIndexServiceType() {
    return container.getServiceType();
  }

  @Override
  public Set<String> getExcludedFields() {
    return Set.of("children");
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (container.getDataModel() != null && container.getDataModel().getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(container.getDataModel().getColumns(), cols, null);

      List<String> columnsWithChildrenName = new ArrayList<>();
      Set<List<TagLabel>> childTags = new HashSet<>();
      for (FlattenColumn col : cols) {
        columnsWithChildrenName.add(col.getName());
        if (col.getTags() != null) {
          childTags.add(col.getTags());
        }
      }
      doc.put("columnNames", columnsWithChildrenName);
      doc.put("columnNamesFuzzy", String.join(" ", columnsWithChildrenName));
      mergeChildTags(doc, childTags);

      SearchIndexUtils.transformColumnExtensionsAtPath(
          doc, "dataModel.columns", Entity.TABLE_COLUMN);
    }

    doc.put("fullPath", container.getFullPath());
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("dataModel.columns.name", 2.0f);
    fields.put(DATA_MODEL_COLUMNS_NAME_KEYWORD, 10.0f);
    fields.put("dataModel.columns.displayName", 2.0f);
    fields.put("dataModel.columns.description", 1.0f);
    fields.put("dataModel.columns.children.name", 2.0f);
    return fields;
  }
}
