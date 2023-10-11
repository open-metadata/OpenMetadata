package org.openmetadata.service.search.indexes;

import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.openmetadata.service.Entity.FIELD_DESCRIPTION;
import static org.openmetadata.service.Entity.FIELD_DISPLAY_NAME;
import static org.openmetadata.service.Entity.FIELD_NAME;
import static org.openmetadata.service.search.EntityBuilderConstant.COLUMNS_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.DISPLAY_NAME_KEYWORD;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_DISPLAY_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FIELD_NAME_NGRAM;
import static org.openmetadata.service.search.EntityBuilderConstant.FULLY_QUALIFIED_NAME_PARTS;
import static org.openmetadata.service.search.EntityBuilderConstant.NAME_KEYWORD;

public class TableIndex implements ColumnIndex {
  private static final List<String> excludeFields =
      List.of(
          "sampleData",
          "tableProfile",
          "joins",
          "changeDescription",
          "viewDefinition, tableProfilerConfig, profile, location, tableQueries, " + "tests, dataModel");

  final Table table;

  public TableIndex(Table table) {
    this.table = table;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(table);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> columnSuggest = new ArrayList<>();
    List<SearchSuggest> schemaSuggest = new ArrayList<>();
    List<SearchSuggest> databaseSuggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    SearchIndexUtils.removeNonIndexableFields(doc, excludeFields);
    if (table.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(table.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        columnSuggest.add(SearchSuggest.builder().input(col.getName()).weight(5).build());
      }
      doc.put("columns_arr",cols);
    }
    parseTableSuggest(suggest);
    serviceSuggest.add(SearchSuggest.builder().input(table.getService().getName()).weight(5).build());
    databaseSuggest.add(SearchSuggest.builder().input(table.getDatabase().getName()).weight(5).build());
    schemaSuggest.add(SearchSuggest.builder().input(table.getDatabaseSchema().getName()).weight(5).build());
    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.TABLE, table));
    doc.put("displayName", table.getDisplayName() != null ? table.getDisplayName() : table.getName());
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(table.getFollowers()));
    doc.put(
        "fqnParts",
        getFQNParts(
            table.getFullyQualifiedName(), suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())));
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("column_suggest", columnSuggest);
    doc.put("schema_suggest", schemaSuggest);
    doc.put("database_suggest", databaseSuggest);
    doc.put("entityType", Entity.TABLE);
    doc.put("serviceType", table.getServiceType());
    if (table.getOwner() != null) {
      doc.put("owner", getOwnerWithDisplayName(table.getOwner()));
    }
    if (table.getDomain() != null) {
      doc.put("domain", getDomainWithDisplayName(table.getDomain()));
    }
    return doc;
  }

  private void parseTableSuggest(List<SearchSuggest> suggest) {
    suggest.add(SearchSuggest.builder().input(table.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(table.getName()).weight(10).build());
    suggest.add(SearchSuggest.builder().input(table.getDatabase().getName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(table.getDatabaseSchema().getName()).weight(5).build());
    // Table FQN has 4 parts
    String[] fqnPartsWithoutService = table.getFullyQualifiedName().split(Pattern.quote(Entity.SEPARATOR), 2);
    if (fqnPartsWithoutService.length == 2) {
      suggest.add(SearchSuggest.builder().input(fqnPartsWithoutService[1]).weight(5).build());
      String[] fqnPartsWithoutDB = fqnPartsWithoutService[1].split(Pattern.quote(Entity.SEPARATOR), 2);
      if (fqnPartsWithoutDB.length == 2) {
        suggest.add(SearchSuggest.builder().input(fqnPartsWithoutDB[1]).weight(5).build());
      }
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = new HashMap<>();
    fields.put(FIELD_DISPLAY_NAME, 15.0f);
    fields.put(FIELD_DISPLAY_NAME_NGRAM, 1.0f);
    fields.put(FIELD_NAME, 15.0f);
    fields.put(FIELD_NAME_NGRAM, 1.0f);
    fields.put(DISPLAY_NAME_KEYWORD, 25.0f);
    fields.put(NAME_KEYWORD, 25.0f);
    fields.put(FULLY_QUALIFIED_NAME_PARTS, 1.0f);
    fields.put(FIELD_DESCRIPTION, 1.0f);
    fields.put(COLUMNS_NAME_KEYWORD, 10.0f);
    fields.put("columns.name", 2.0f);
    fields.put("columns.name.ngram", 1.0f);
    fields.put("columns.displayName", 1.0f);
    fields.put("columns.description", 1.0f);
    fields.put("columns.children.name", 2.0f);
    return fields;
  }
}
