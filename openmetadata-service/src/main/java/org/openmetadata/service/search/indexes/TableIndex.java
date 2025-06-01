package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeSummaryMap;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.search.models.SearchSuggest;

public record TableIndex(Table table) implements ColumnIndex {
  private static final Set<String> excludeFields =
      Set.of(
          "sampleData",
          "tableProfile",
          "joins",
          "changeDescription",
          "schemaDefinition, tableProfilerConfig, profile, location, tableQueries, tests, dataModel",
          "testSuite.changeDescription");

  @Override
  public List<SearchSuggest> getSuggest() {
    List<SearchSuggest> suggest = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(table.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(table.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(table.getDatabase().getName()).weight(5).build());
    suggest.add(
        SearchSuggest.builder().input(table.getDatabaseSchema().getName()).weight(5).build());
    // Table FQN has 4 parts
    String[] fqnPartsWithoutService =
        table.getFullyQualifiedName().split(Pattern.quote(Entity.SEPARATOR), 2);
    if (fqnPartsWithoutService.length == 2) {
      suggest.add(SearchSuggest.builder().input(fqnPartsWithoutService[1]).weight(5).build());
      String[] fqnPartsWithoutDB =
          fqnPartsWithoutService[1].split(Pattern.quote(Entity.SEPARATOR), 2);
      if (fqnPartsWithoutDB.length == 2) {
        suggest.add(SearchSuggest.builder().input(fqnPartsWithoutDB[1]).weight(5).build());
      }
    }
    return suggest;
  }

  @Override
  public Object getEntity() {
    return table;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    List<SearchSuggest> columnSuggest = new ArrayList<>();
    List<SearchSuggest> schemaSuggest = new ArrayList<>();
    List<SearchSuggest> databaseSuggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    Set<List<TagLabel>> tagsWithChildren = new HashSet<>();
    List<String> columnsWithChildrenName = new ArrayList<>();
    if (table.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(table.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        columnSuggest.add(SearchSuggest.builder().input(col.getName()).weight(5).build());
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
    serviceSuggest.add(
        SearchSuggest.builder().input(table.getService().getName()).weight(5).build());
    databaseSuggest.add(
        SearchSuggest.builder().input(table.getDatabase().getName()).weight(5).build());
    schemaSuggest.add(
        SearchSuggest.builder().input(table.getDatabaseSchema().getName()).weight(5).build());
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
    doc.put("service_suggest", serviceSuggest);
    doc.put("column_suggest", columnSuggest);
    doc.put("schema_suggest", schemaSuggest);
    doc.put("database_suggest", databaseSuggest);
    doc.put("serviceType", table.getServiceType());
    doc.put("locationPath", table.getLocationPath());
    doc.put("schemaDefinition", table.getSchemaDefinition());
    doc.put("service", getEntityWithDisplayName(table.getService()));
    doc.put("database", getEntityWithDisplayName(table.getDatabase()));
    doc.put("upstreamLineage", SearchIndex.getLineageData(table.getEntityReference()));
    doc.put("processedLineage", table.getProcessedLineage());
    doc.put("entityRelationship", SearchIndex.populateEntityRelationshipData(table));
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
