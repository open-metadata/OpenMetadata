package org.openmetadata.service.elasticsearch;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.JsonUtils;

public class TableIndex implements ColumnIndex {
  private static final List<String> excludeFields =
      List.of(
          "sampleData",
          "tableProfile",
          "joins",
          "changeDescription",
          "tableQueries, viewDefinition, tableProfilerConfig, profile, location, tableQueries, " + "tests, dataModel");

  final Table table;

  public TableIndex(Table table) {
    this.table = table;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(table);
    List<ElasticSearchSuggest> suggest = new ArrayList<>();
    List<ElasticSearchSuggest> columnSuggest = new ArrayList<>();
    List<ElasticSearchSuggest> schemaSuggest = new ArrayList<>();
    List<ElasticSearchSuggest> databaseSuggest = new ArrayList<>();
    List<ElasticSearchSuggest> serviceSuggest = new ArrayList<>();
    List<TagLabel> tags = new ArrayList<>();
    ElasticSearchIndexUtils.removeNonIndexableFields(doc, excludeFields);

    if (table.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(table.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        if (col.getTags() != null) {
          tags.addAll(col.getTags());
        }
        columnSuggest.add(ElasticSearchSuggest.builder().input(col.getName()).weight(5).build());
      }
    }
    tags.addAll(ElasticSearchIndexUtils.parseTags(table.getTags()));
    parseTableSuggest(suggest);
    serviceSuggest.add(ElasticSearchSuggest.builder().input(table.getService().getName()).weight(5).build());
    databaseSuggest.add(ElasticSearchSuggest.builder().input(table.getDatabase().getName()).weight(5).build());
    schemaSuggest.add(ElasticSearchSuggest.builder().input(table.getDatabaseSchema().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(tags);

    doc.put("displayName", table.getDisplayName() != null ? table.getDisplayName() : table.getName());
    doc.put("tags", parseTags.tags);
    doc.put("tier", parseTags.tierTag);
    doc.put("followers", ElasticSearchIndexUtils.parseFollowers(table.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("column_suggest", columnSuggest);
    doc.put("schema_suggest", schemaSuggest);
    doc.put("database_suggest", databaseSuggest);
    doc.put("entityType", Entity.TABLE);
    doc.put("serviceType", table.getServiceType());
    return doc;
  }

  private void parseTableSuggest(List<ElasticSearchSuggest> suggest) {
    suggest.add(ElasticSearchSuggest.builder().input(table.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(table.getName()).weight(10).build());
    // Table FQN has 4 parts
    String[] fqnPartsWithoutService = table.getFullyQualifiedName().split(Pattern.quote(Entity.SEPARATOR), 2);
    if (fqnPartsWithoutService.length == 2) {
      suggest.add(ElasticSearchSuggest.builder().input(fqnPartsWithoutService[1]).weight(5).build());
      String[] fqnPartsWithoutDB = fqnPartsWithoutService[1].split(Pattern.quote(Entity.SEPARATOR), 2);
      if (fqnPartsWithoutDB.length == 2) {
        suggest.add(ElasticSearchSuggest.builder().input(fqnPartsWithoutDB[1]).weight(5).build());
      }
    }
  }
}
