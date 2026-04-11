package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;

public record DashboardDataModelIndex(DashboardDataModel dashboardDataModel)
    implements ColumnIndex, DataAssetIndex {

  @Override
  public Object getEntity() {
    return dashboardDataModel;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.DASHBOARD_DATA_MODEL;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (dashboardDataModel.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(dashboardDataModel.getColumns(), cols, null);

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

      SearchIndexUtils.transformColumnExtensions(doc, Entity.DASHBOARD_DATA_MODEL_COLUMN);
    }

    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put(COLUMNS_NAME_KEYWORD, 10.0f);
    fields.put("columns.name", 2.0f);
    fields.put("columns.displayName", 1.0f);
    fields.put("columns.description", 1.0f);
    fields.put("columns.children.name", 2.0f);
    return fields;
  }
}
