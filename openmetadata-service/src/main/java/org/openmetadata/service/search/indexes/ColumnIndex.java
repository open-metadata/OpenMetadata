package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.util.FullyQualifiedName;

public interface ColumnIndex extends SearchIndex {
  default void parseColumns(
      List<Column> columns, List<FlattenColumn> flattenColumns, String parentColumn) {
    parseColumns(columns, flattenColumns, parentColumn, 1, SearchFieldLimits.active());
  }

  private void parseColumns(
      List<Column> columns,
      List<FlattenColumn> flattenColumns,
      String parentColumn,
      int depth,
      SearchFieldLimits limits) {
    if (depth > limits.getDepthLimit()) {
      LOG.warn(
          "Dropping columns under '{}' beyond mapping depth limit {}",
          parentColumn,
          limits.getDepthLimit());
    } else {
      addColumnsWithinLimit(columns, flattenColumns, parentColumn, depth, limits);
    }
  }

  private void addColumnsWithinLimit(
      List<Column> columns,
      List<FlattenColumn> flattenColumns,
      String parentColumn,
      int depth,
      SearchFieldLimits limits) {
    Optional<String> optParentColumn =
        Optional.ofNullable(parentColumn).filter(Predicate.not(String::isEmpty));
    int index = 0;
    boolean capReached = false;
    while (index < columns.size() && !capReached) {
      if (flattenColumns.size() >= limits.getMaxColumns()) {
        LOG.warn(
            "Reached max indexed columns {}; dropping remaining columns under '{}'",
            limits.getMaxColumns(),
            parentColumn);
        capReached = true;
      } else {
        Column col = columns.get(index);
        List<TagLabel> tags = col.getTags() != null ? col.getTags() : new ArrayList<>();
        String columnName = addFlattenColumn(col, optParentColumn, tags, flattenColumns);
        if (col.getChildren() != null) {
          parseColumns(col.getChildren(), flattenColumns, columnName, depth + 1, limits);
        }
        index++;
      }
    }
  }

  private String addFlattenColumn(
      Column col,
      Optional<String> optParentColumn,
      List<TagLabel> tags,
      List<FlattenColumn> flattenColumns) {
    String columnName = col.getName();
    if (optParentColumn.isPresent()) {
      columnName = FullyQualifiedName.add(optParentColumn.get(), columnName);
    }
    FlattenColumn flattenColumn =
        FlattenColumn.builder().name(columnName).description(col.getDescription()).build();
    if (!tags.isEmpty()) {
      flattenColumn.setTags(tags);
    }
    flattenColumns.add(flattenColumn);
    return columnName;
  }

  default String getColumnDescriptionStatus(EntityInterface entity) {
    List<Class<?>> interfaces = Arrays.asList(entity.getClass().getInterfaces());
    if (interfaces.contains(ColumnsEntityInterface.class)) {
      for (Column col : ((ColumnsEntityInterface) entity).getColumns()) {
        if (CommonUtil.nullOrEmpty(col.getDescription())) {
          return "INCOMPLETE";
        }
      }
    }
    return "COMPLETE";
  }
}
