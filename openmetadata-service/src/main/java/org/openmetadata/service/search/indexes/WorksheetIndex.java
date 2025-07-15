package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.models.FlattenColumn;

public record WorksheetIndex(Worksheet worksheet) implements ColumnIndex {
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
  public Set<String> getExcludedFields() {
    return excludeFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Set<List<TagLabel>> tagsWithChildren = new HashSet<>();
    List<String> columnsWithChildrenName = new ArrayList<>();

    if (worksheet.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(worksheet.getColumns(), cols, null);

      for (FlattenColumn col : cols) {
        columnsWithChildrenName.add(col.getName());
        if (col.getTags() != null) {
          tagsWithChildren.add(col.getTags());
        }
      }
      doc.put("columnNames", columnsWithChildrenName);
      // Add flat column names field for fuzzy search to avoid array-based clause multiplication
      doc.put("columnNamesFuzzy", String.join(" ", columnsWithChildrenName));
      doc.put("columnDescriptionStatus", getColumnDescriptionStatus(worksheet));
    }

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.WORKSHEET, worksheet));
    tagsWithChildren.add(parseTags.getTags());
    List<TagLabel> flattenedTagList =
        tagsWithChildren.stream()
            .flatMap(List::stream)
            .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    Map<String, Object> commonAttributes = getCommonAttributesMap(worksheet, Entity.WORKSHEET);
    doc.putAll(commonAttributes);
    doc.put("tags", flattenedTagList);
    doc.put("tier", parseTags.getTierTag());
    doc.put("serviceType", worksheet.getServiceType());
    doc.put("service", getEntityWithDisplayName(worksheet.getService()));
    doc.put("spreadsheet", getEntityWithDisplayName(worksheet.getSpreadsheet()));
    doc.put("worksheetId", worksheet.getWorksheetId());
    doc.put("index", worksheet.getIndex());
    doc.put("rowCount", worksheet.getRowCount());
    doc.put("columnCount", worksheet.getColumnCount());
    doc.put("isHidden", worksheet.getIsHidden());
    doc.put("upstreamLineage", SearchIndex.getLineageData(worksheet.getEntityReference()));
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
