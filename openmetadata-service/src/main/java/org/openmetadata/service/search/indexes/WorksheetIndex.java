package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenColumn;

public record WorksheetIndex(Worksheet worksheet) implements ColumnIndex, DataAssetIndex {
  private static final Set<String> excludeFields =
      Set.of(
          "sampleData",
          "changeDescription",
          "incrementalChangeDescription",
          "columns.profile",
          "columns.tests");

  @Override
  public Object getEntity() {
    return worksheet;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.WORKSHEET;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  @Override
  public Object getIndexServiceType() {
    return worksheet.getServiceType();
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    // WorksheetRepository.clearFields nulls columns when "columns" is absent from the field set,
    // so reindex must request it explicitly. Without it, columnNames / columnNamesFuzzy /
    // columnDescriptionStatus / child column tags are dropped from worksheet_search_index and
    // column-name search in Explore → Worksheets returns no results.
    fields.add("columns");
    return Set.copyOf(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (worksheet.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(worksheet.getColumns(), cols, null);

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
      doc.put("columnDescriptionStatus", getColumnDescriptionStatus(worksheet));
      mergeChildTags(doc, childTags);

      SearchIndexUtils.transformColumnExtensions(doc, Entity.TABLE_COLUMN);
    }

    doc.put("spreadsheet", getEntityWithDisplayName(worksheet.getSpreadsheet()));
    doc.put("worksheetId", worksheet.getWorksheetId());
    doc.put("index", worksheet.getIndex());
    doc.put("rowCount", worksheet.getRowCount());
    doc.put("columnCount", worksheet.getColumnCount());
    doc.put("isHidden", worksheet.getIsHidden());
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("columns.name", 5.0f);
    fields.put("columns.displayName", 5.0f);
    fields.put("columns.description", 2.0f);
    fields.put("columnNamesFuzzy", 3.0f);
    return fields;
  }
}
