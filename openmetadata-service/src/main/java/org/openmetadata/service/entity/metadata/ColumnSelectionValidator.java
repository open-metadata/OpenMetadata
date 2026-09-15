package org.openmetadata.service.entity.metadata;

import java.util.List;
import java.util.Objects;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;

/** Validates a top-level column selection while preserving the existing wildcard contract. */
public final class ColumnSelectionValidator {
  private ColumnSelectionValidator() {}

  public static void validate(final List<Column> columns, final String columnName) {
    validate(columns, columnName, Boolean.TRUE);
  }

  public static void validate(
      final List<Column> columns, final String columnName, final Boolean caseSensitive) {
    if (columns == null) {
      throw new IllegalArgumentException("Columns list cannot be null");
    }
    if (!matches(columns, columnName, caseSensitive) && !columnName.equalsIgnoreCase("all")) {
      throw new IllegalArgumentException("Invalid column name " + columnName);
    }
  }

  private static boolean matches(
      final List<Column> columns, final String columnName, final Boolean caseSensitive) {
    if (Boolean.FALSE.equals(caseSensitive)) {
      return columns.stream()
          .filter(Objects::nonNull)
          .anyMatch(col -> col.getName().equalsIgnoreCase(columnName));
    }
    return columns.stream()
        .filter(Objects::nonNull)
        .anyMatch(col -> col.getName().equals(columnName));
  }

  public static void validate(final Table table, final String columnName) {
    validate(table, columnName, Boolean.TRUE);
  }

  public static void validate(
      final Table table, final String columnName, final Boolean caseSensitive) {
    validate(table.getColumns(), columnName, caseSensitive);
  }
}
