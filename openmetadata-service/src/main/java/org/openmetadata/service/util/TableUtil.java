package org.openmetadata.service.util;

import java.util.List;
import java.util.Set;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;

public class TableUtil {
  public static Column getColumnNameForProfiler(
      List<Column> columnList, ColumnProfile columnProfile, String parentName) {
    for (Column col : columnList) {
      String columnName;
      if (parentName != null) {
        columnName = String.format("%s.%s", parentName, col.getName());
      } else {
        columnName = col.getName();
      }
      if (columnName.equals(columnProfile.getName())) {
        return col;
      }
      if (col.getChildren() != null) {
        Column childColumn = getColumnNameForProfiler(col.getChildren(), columnProfile, columnName);
        if (childColumn != null) {
          return childColumn;
        }
      }
    }
    return null;
  }

  /**
   * Check if a column or any of its children match any of the given tag FQNs. Recurses through the
   * column hierarchy to find matches at any nesting level.
   */
  public static boolean columnMatchesAnyTag(Column column, Set<String> tagFQNs) {
    if (column.getTags() != null
        && column.getTags().stream().anyMatch(t -> tagFQNs.contains(t.getTagFQN()))) {
      return true;
    }
    if (column.getChildren() != null) {
      return column.getChildren().stream().anyMatch(child -> columnMatchesAnyTag(child, tagFQNs));
    }
    return false;
  }
}
