package org.openmetadata.service.search.indexes;

import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.List;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.search.models.FlattenColumn;

public interface ColumnIndex extends SearchIndex {
  default void parseColumns(
      List<Column> columns, List<FlattenColumn> flattenColumns, String parentColumn) {
    ColumnFlattener.parseColumns(columns, flattenColumns, parentColumn);
  }

  default String getColumnDescriptionStatus(EntityInterface<?> entity) {
    String status = "COMPLETE";
    List<Class<?>> interfaces = Arrays.asList(entity.getClass().getInterfaces());
    if (interfaces.contains(ColumnsEntityInterface.class)
        && hasUndocumentedColumn(((ColumnsEntityInterface) entity).getColumns())) {
      status = "INCOMPLETE";
    }
    return status;
  }

  private boolean hasUndocumentedColumn(List<Column> columns) {
    boolean undocumented = false;
    Deque<Column> pending = new ArrayDeque<>();
    pushColumns(pending, columns);
    while (!pending.isEmpty() && !undocumented) {
      Column col = pending.pop();
      if (CommonUtil.nullOrEmpty(col.getDescription())) {
        undocumented = true;
      } else {
        pushColumns(pending, col.getChildren());
      }
    }
    return undocumented;
  }

  private void pushColumns(Deque<Column> pending, List<Column> columns) {
    if (columns != null) {
      for (Column col : columns) {
        if (col != null) {
          pending.push(col);
        }
      }
    }
  }
}
