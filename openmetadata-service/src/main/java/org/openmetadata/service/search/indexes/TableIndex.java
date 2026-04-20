package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;

public record TableIndex(Table table) implements ColumnIndex, DataAssetIndex {
  private static final Set<String> excludeFields =
      Set.of(
          "sampleData",
          "tableProfile",
          "joins",
          "changeDescription",
          "tableProfilerConfig",
          "profile",
          "location",
          "queries",
          "tests",
          "testSuite.changeDescription");

  @Override
  public Object getEntity() {
    return table;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.TABLE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  @Override
  public Object getIndexServiceType() {
    return table.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (table.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(table.getColumns(), cols, null);

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
      doc.put("columnDescriptionStatus", getColumnDescriptionStatus(table));
      mergeChildTags(doc, childTags);

      SearchIndexUtils.transformColumnExtensions(doc, Entity.TABLE_COLUMN);
    }

    doc.put("locationPath", table.getLocationPath());
    doc.put("schemaDefinition", table.getSchemaDefinition());
    doc.put("database", getEntityWithDisplayName(table.getDatabase()));
    doc.put("processedLineage", table.getProcessedLineage());
    doc.put(
        "upstreamEntityRelationship", SearchIndex.populateUpstreamEntityRelationshipData(table));
    doc.put("databaseSchema", getEntityWithDisplayName(table.getDatabaseSchema()));
    doc.put(
        "changeSummary",
        Optional.ofNullable(table.getChangeDescription())
            .map(ChangeDescription::getChangeSummary)
            .map(ChangeSummaryMap::getAdditionalProperties)
            .orElse(null));

    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("columns.name", 5.0f);
    fields.put("columns.displayName", 5.0f);
    fields.put("columns.description", 2.0f);
    fields.put("columns.children.name", 3.0f);
    return fields;
  }
}
