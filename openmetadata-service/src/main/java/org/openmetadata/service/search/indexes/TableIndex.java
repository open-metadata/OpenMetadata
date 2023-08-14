package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.JsonUtils;

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
    if (table.getOwner() != null) {
      EntityReference owner = table.getOwner();
      owner.setDisplayName(CommonUtil.nullOrEmpty(owner.getDisplayName()) ? owner.getName() : owner.getDisplayName());
      table.setOwner(owner);
    }
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
    doc.put("suggest", suggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("column_suggest", columnSuggest);
    doc.put("schema_suggest", schemaSuggest);
    doc.put("database_suggest", databaseSuggest);
    doc.put("entityType", Entity.TABLE);
    doc.put("serviceType", table.getServiceType());
    return doc;
  }

  private void parseTableSuggest(List<SearchSuggest> suggest) {
    suggest.add(SearchSuggest.builder().input(table.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(table.getName()).weight(10).build());
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
}
