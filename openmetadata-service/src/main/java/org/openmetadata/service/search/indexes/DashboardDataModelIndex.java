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

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    // "columns" is fields-gated in DashboardDataModelRepository.setFieldsInBulk; without it
    // column-level tags are not hydrated (fetchAndSetColumnTags skips
    // bulkPopulateEntityFieldTags / inheritEntityTermsOnFields, breaking the tag merge in
    // buildSearchIndexDocInternal) and reference-typed column custom properties are never
    // merged back from custom_property_reference via applyColumnReferences. A reindex-built
    // dashboard_data_model_search_index doc would then lose columns.customPropertiesTyped
    // reference values and serve stale/missing column tags in the Explore tag facet, until
    // each data model is edited again. Mirrors TableIndex / WorksheetIndex / FileIndex /
    // ContainerIndex.
    fields.add("columns");
    return Set.copyOf(fields);
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
    fields.put("columnNamesFuzzy", 2.0f);
    return fields;
  }
}
