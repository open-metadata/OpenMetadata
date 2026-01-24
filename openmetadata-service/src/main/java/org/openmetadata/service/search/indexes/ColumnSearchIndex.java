package org.openmetadata.service.search.indexes;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.util.FullyQualifiedName;

public class ColumnSearchIndex implements SearchIndex {
  private final Column column;
  private final Table parentTable;

  public ColumnSearchIndex(Column column, Table parentTable) {
    this.column = column;
    this.parentTable = parentTable;
  }

  @Override
  public Object getEntity() {
    return column;
  }

  @Override
  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    String columnId = generateColumnId(column.getFullyQualifiedName());
    doc.put("id", columnId);
    doc.put("name", column.getName());
    doc.put(
        "displayName",
        column.getDisplayName() != null && !column.getDisplayName().isBlank()
            ? column.getDisplayName()
            : column.getName());
    doc.put("fullyQualifiedName", column.getFullyQualifiedName());
    doc.put("fqnParts", getFQNParts(column.getFullyQualifiedName()));
    doc.put("fqnHash", FullyQualifiedName.buildHash(column.getFullyQualifiedName()));
    doc.put("description", column.getDescription());
    doc.put("dataType", column.getDataType() != null ? column.getDataType().toString() : null);
    doc.put("dataTypeDisplay", column.getDataTypeDisplay());
    doc.put(
        "constraint", column.getConstraint() != null ? column.getConstraint().toString() : null);
    doc.put("ordinalPosition", column.getOrdinalPosition());
    doc.put("entityType", Entity.TABLE_COLUMN);
    doc.put("deleted", parentTable.getDeleted() != null && parentTable.getDeleted());
    doc.put("updatedAt", parentTable.getUpdatedAt());
    doc.put("updatedBy", parentTable.getUpdatedBy());
    doc.put("version", parentTable.getVersion());
    doc.put("descriptionStatus", nullOrEmpty(column.getDescription()) ? "INCOMPLETE" : "COMPLETE");

    Map<String, Object> tableRef = new HashMap<>();
    tableRef.put("id", parentTable.getId().toString());
    tableRef.put("name", parentTable.getName());
    tableRef.put(
        "displayName",
        parentTable.getDisplayName() != null && !parentTable.getDisplayName().isBlank()
            ? parentTable.getDisplayName()
            : parentTable.getName());
    tableRef.put("fullyQualifiedName", parentTable.getFullyQualifiedName());
    tableRef.put("description", parentTable.getDescription());
    tableRef.put("deleted", parentTable.getDeleted());
    tableRef.put("type", Entity.TABLE);
    doc.put("table", tableRef);

    if (parentTable.getService() != null) {
      doc.put("service", getEntityRefMap(parentTable.getService()));
    }
    if (parentTable.getDatabase() != null) {
      doc.put("database", getEntityRefMap(parentTable.getDatabase()));
    }
    if (parentTable.getDatabaseSchema() != null) {
      doc.put("databaseSchema", getEntityRefMap(parentTable.getDatabaseSchema()));
    }
    if (parentTable.getServiceType() != null) {
      doc.put("serviceType", parentTable.getServiceType().toString());
    }

    if (parentTable.getOwners() != null) {
      doc.put("owners", getEntitiesWithDisplayName(parentTable.getOwners()));
    }
    if (parentTable.getDomains() != null) {
      doc.put("domains", getEntitiesWithDisplayName(parentTable.getDomains()));
    }
    if (parentTable.getFollowers() != null) {
      doc.put("followers", SearchIndexUtils.parseFollowers(parentTable.getFollowers()));
    }
    int totalVotes =
        nullOrEmpty(parentTable.getVotes())
            ? 0
            : Math.max(
                parentTable.getVotes().getUpVotes() - parentTable.getVotes().getDownVotes(), 0);
    doc.put("totalVotes", totalVotes);

    List<TagLabel> columnTags = column.getTags();
    if (columnTags != null && !columnTags.isEmpty()) {
      ParseTags parseTags = new ParseTags(columnTags);
      doc.put("tags", parseTags.getTags());
      doc.put("tier", parseTags.getTierTag());
      doc.put("classificationTags", parseTags.getClassificationTags());
      doc.put("glossaryTags", parseTags.getGlossaryTags());
    }

    if (column.getExtension() != null) {
      doc.put("extension", column.getExtension());
    }

    return doc;
  }

  private String generateColumnId(String columnFQN) {
    return UUID.nameUUIDFromBytes(columnFQN.getBytes(StandardCharsets.UTF_8)).toString();
  }

  private Map<String, Object> getEntityRefMap(EntityReference entityRef) {
    if (entityRef == null) {
      return null;
    }
    Map<String, Object> refMap = new HashMap<>();
    refMap.put("id", entityRef.getId() != null ? entityRef.getId().toString() : null);
    refMap.put("name", entityRef.getName());
    refMap.put(
        "displayName",
        entityRef.getDisplayName() != null && !entityRef.getDisplayName().isBlank()
            ? entityRef.getDisplayName()
            : entityRef.getName());
    refMap.put("fullyQualifiedName", entityRef.getFullyQualifiedName());
    refMap.put("description", entityRef.getDescription());
    refMap.put("deleted", entityRef.getDeleted());
    refMap.put("type", entityRef.getType());
    return refMap;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("name", 10.0f);
    fields.put("name.keyword", 20.0f);
    fields.put("name.ngram", 1.0f);
    fields.put("name.compound", 8.0f);
    fields.put("displayName", 7.0f);
    fields.put("displayName.keyword", 20.0f);
    fields.put("description", 2.0f);
    fields.put("dataType", 3.0f);
    fields.put("table.name", 5.0f);
    fields.put("table.displayName", 5.0f);
    fields.put("service.displayName", 2.0f);
    return fields;
  }

  public static List<Column> flattenColumns(List<Column> columns) {
    List<Column> result = new ArrayList<>();
    if (columns == null) {
      return result;
    }
    for (Column col : columns) {
      result.add(col);
      if (col.getChildren() != null && !col.getChildren().isEmpty()) {
        result.addAll(flattenColumns(col.getChildren()));
      }
    }
    return result;
  }
}
