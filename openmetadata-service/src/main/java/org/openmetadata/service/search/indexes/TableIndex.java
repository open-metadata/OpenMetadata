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
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.FlattenColumn;

public record TableIndex(Table table) implements ColumnIndex {
  private static final Set<String> excludeFields =
      Set.of(
          "sampleData",
          "tableProfile",
          "joins",
          "changeDescription",
          "votes",
          "schemaDefinition, tableProfilerConfig, profile, location, tableQueries, tests, dataModel",
          "testSuite.changeDescription");

  @Override
  public Object getEntity() {
    return table;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Set<List<TagLabel>> tagsWithChildren = new HashSet<>();
    List<String> columnsWithChildrenName = new ArrayList<>();
    if (table.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(table.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        columnsWithChildrenName.add(col.getName());
        if (col.getTags() != null) {
          tagsWithChildren.add(col.getTags());
        }
      }
      doc.put("columnNames", columnsWithChildrenName);
      // Add flat column names field for fuzzy search to avoid array-based clause multiplication
      doc.put("columnNamesFuzzy", String.join(" ", columnsWithChildrenName));
      doc.put("columnDescriptionStatus", getColumnDescriptionStatus(table));
    }

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.TABLE, table));
    tagsWithChildren.add(parseTags.getTags());
    List<TagLabel> flattenedTagList =
        tagsWithChildren.stream()
            .flatMap(List::stream)
            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    Map<String, Object> commonAttributes = getCommonAttributesMap(table, Entity.TABLE);
    doc.putAll(commonAttributes);
    doc.put("tags", flattenedTagList);
    doc.put("tier", parseTags.getTierTag());
    doc.put("serviceType", table.getServiceType());
    doc.put("locationPath", table.getLocationPath());
    doc.put("schemaDefinition", table.getSchemaDefinition());
    doc.put("service", getEntityWithDisplayName(table.getService()));
    doc.put("database", getEntityWithDisplayName(table.getDatabase()));
    doc.put("upstreamLineage", SearchIndex.getLineageData(table.getEntityReference()));
    doc.put("processedLineage", table.getProcessedLineage());
    doc.put("entityRelationship", SearchIndex.populateEntityRelationshipData(table));
    doc.put("databaseSchema", getEntityWithDisplayName(table.getDatabaseSchema()));
    doc.put("queries", table.getQueries());
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
