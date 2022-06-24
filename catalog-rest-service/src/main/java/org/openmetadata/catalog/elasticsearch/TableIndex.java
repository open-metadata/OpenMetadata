package org.openmetadata.catalog.elasticsearch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

public class TableIndex implements ElasticSearchIndex {
  final List<String> excludeFields = List.of("sampleData", "tableProfile", "joins", "changeDescription");
  Table table;

  public TableIndex(Table table) {
    this.table = table;
  }

  public Map<String, Object> buildESDoc() throws JsonProcessingException {
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
    suggest.add(ElasticSearchSuggest.builder().input(table.getFullyQualifiedName()).weight(5).build());
    suggest.add(ElasticSearchSuggest.builder().input(table.getName()).weight(10).build());
    serviceSuggest.add(ElasticSearchSuggest.builder().input(table.getService().getName()).weight(5).build());
    databaseSuggest.add(ElasticSearchSuggest.builder().input(table.getDatabase().getName()).weight(5).build());
    schemaSuggest.add(ElasticSearchSuggest.builder().input(table.getDatabaseSchema().getName()).weight(5).build());

    ParseTags parseTags = new ParseTags(tags);
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

  private void parseColumns(List<Column> columns, List<FlattenColumn> flattenColumns, String parentColumn) {
    Optional<String> optParentColumn = Optional.ofNullable(parentColumn).filter(Predicate.not(String::isEmpty));
    List<TagLabel> tags = new ArrayList<>();
    for (Column col : columns) {
      String columnName = col.getName();
      if (optParentColumn.isPresent()) {
        columnName = FullyQualifiedName.add(optParentColumn.get(), columnName);
      }
      if (col.getTags() != null) {
        tags = col.getTags();
      }

      FlattenColumn flattenColumn = FlattenColumn.builder().name(columnName).description(col.getDescription()).build();

      if (!tags.isEmpty()) {
        flattenColumn.tags = tags;
      }
      flattenColumns.add(flattenColumn);
      if (col.getChildren() != null) {
        parseColumns(col.getChildren(), flattenColumns, col.getName());
      }
    }
  }
}
