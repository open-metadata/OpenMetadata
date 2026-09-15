package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.FlattenColumn;

public record FileIndex(File file) implements ColumnIndex, DataAssetIndex {
  final Set<String> excludeFileFields = Set.of("changeDescription", "incrementalChangeDescription");

  @Override
  public Object getEntity() {
    return file;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.FILE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeFileFields;
  }

  @Override
  public Object getIndexServiceType() {
    return file.getServiceType();
  }

  @Override
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    // FileRepository.clearFields nulls columns when "columns" is absent from the field set.
    // Without requesting it, file column-name search breaks after reindex — same pattern as
    // WorksheetIndex.
    fields.add("columns");
    return Set.copyOf(fields);
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    if (file.getColumns() != null) {
      List<FlattenColumn> cols = new ArrayList<>();
      parseColumns(file.getColumns(), cols, null);

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
    }
    doc.put("directory", getEntityWithDisplayName(file.getDirectory()));
    doc.put("fileType", file.getFileType());
    doc.put("mimeType", file.getMimeType());
    doc.put("fileExtension", file.getFileExtension());
    doc.put("path", file.getPath());
    doc.put("size", file.getSize());
    doc.put("checksum", file.getChecksum());
    doc.put("isShared", file.getIsShared());
    doc.put("fileVersion", file.getFileVersion());
    doc.put("createdTime", file.getCreatedTime());
    doc.put("modifiedTime", file.getModifiedTime());
    doc.put("lastModifiedBy", getEntityWithDisplayName(file.getLastModifiedBy()));
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("path", 5.0f);
    fields.put("fileType", 3.0f);
    fields.put("mimeType", 2.0f);
    fields.put("fileExtension", 3.0f);
    fields.put("columns.name", 5.0f);
    fields.put("columns.displayName", 5.0f);
    fields.put("columns.description", 2.0f);
    fields.put("columnNamesFuzzy", 3.0f);
    return fields;
  }
}
