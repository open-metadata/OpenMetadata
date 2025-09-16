package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.findChildren;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.util.FullyQualifiedName;

public final class ColumnUtil {
  private ColumnUtil() {}

  public static List<Column> cloneWithoutTags(List<Column> columns) {
    if (nullOrEmpty(columns)) {
      return columns;
    }
    List<Column> copy = new ArrayList<>();
    columns.forEach(c -> copy.add(cloneWithoutTags(c)));
    return copy;
  }

  private static Column cloneWithoutTags(Column column) {
    List<Column> children = cloneWithoutTags(column.getChildren());
    return new Column()
        .withDescription(column.getDescription())
        .withName(column.getName())
        .withDisplayName(column.getDisplayName())
        .withFullyQualifiedName(column.getFullyQualifiedName())
        .withArrayDataType(column.getArrayDataType())
        .withConstraint(column.getConstraint())
        .withDataTypeDisplay(column.getDataTypeDisplay())
        .withDataType(column.getDataType())
        .withDataLength(column.getDataLength())
        .withPrecision(column.getPrecision())
        .withScale(column.getScale())
        .withOrdinalPosition(column.getOrdinalPosition())
        .withChildren(children);
  }

  public static void setColumnFQN(String parentFQN, List<Column> columns) {
    columns.forEach(
        c -> {
          String columnFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(columnFqn);
          if (c.getChildren() != null) {
            setColumnFQN(columnFqn, c.getChildren());
          }
        });
  }

  // Validate if a given column exists in the table
  public static void validateColumnFQN(List<Column> columns, String columnFQN) {
    boolean exists = findChildren(columns, "getChildren", columnFQN);
    if (!exists) {
      throw new IllegalArgumentException(CatalogExceptionMessage.invalidColumnFQN(columnFQN));
    }
  }

  // validate if a given field exists in the topic
  public static void validateFieldFQN(List<Field> fields, String fieldFQN) {
    boolean exists = findChildren(fields, "getChildren", fieldFQN);
    if (!exists) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("field", fieldFQN));
    }
  }

  public static void validateSearchIndexFieldFQN(List<SearchIndexField> fields, String fieldFQN) {
    boolean exists = findChildren(fields, "getChildren", fieldFQN);
    if (!exists) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidFieldName("field", fieldFQN));
    }
  }

  public static Set<String> getAllTags(Column column) {
    Set<String> tags = new HashSet<>();
    if (!listOrEmpty(column.getTags()).isEmpty()) {
      tags.addAll(column.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toSet()));
    }
    for (Column c : listOrEmpty(column.getChildren())) {
      tags.addAll(getAllTags(c));
    }
    return tags;
  }

  /**
   * Finds a column by its Fully Qualified Name (FQN).
   */
  public static Column findColumn(List<Column> columns, String columnFqn) {
    for (Column column : columns) {
      if (column.getFullyQualifiedName().equals(columnFqn)) {
        return column;
      }
      if (column.getChildren() != null) {
        Column childColumn = findColumn(column.getChildren(), columnFqn);
        if (childColumn != null) {
          return childColumn;
        }
      }
    }
    return null;
  }

  /**
   * Adds or updates a column within the given column list.
   * If the column exists, it updates its values.
   * If the column does not exist, it adds it to the list.
   */
  public static void addOrUpdateColumn(List<Column> columns, Column newColumn) {
    Optional<Column> existingColumn =
        columns.stream()
            .filter(col -> col.getFullyQualifiedName().equals(newColumn.getFullyQualifiedName()))
            .findFirst();

    if (existingColumn.isPresent()) {
      // Update existing column
      Column col = existingColumn.get();
      col.withDisplayName(newColumn.getDisplayName())
          .withDescription(newColumn.getDescription())
          .withDataType(newColumn.getDataType())
          .withDataTypeDisplay(newColumn.getDataTypeDisplay())
          .withDataLength(newColumn.getDataLength())
          .withChildren(newColumn.getChildren())
          .withArrayDataType(newColumn.getArrayDataType());
    } else {
      // Add new column
      columns.add(newColumn);
    }
  }
}
