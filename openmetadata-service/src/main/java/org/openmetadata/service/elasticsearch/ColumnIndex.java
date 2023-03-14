package org.openmetadata.service.elasticsearch;

import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.util.FullyQualifiedName;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;

public interface ColumnIndex extends ElasticSearchIndex {
  default void parseColumns(List<Column> columns, List<FlattenColumn> flattenColumns, String parentColumn) {
    Optional<String> optParentColumn = Optional.ofNullable(parentColumn).filter(Predicate.not(String::isEmpty));
    List<TagLabel> tags = new ArrayList<>();
    for (Column col : columns) {
      String columnName = col.getName();
      if (optParentColumn.isPresent()) {
        columnName = FullyQualifiedName.add(optParentColumn.get(), columnName);
      }
      if (col.getTags() != null) {
        tags = col.getTags();
      }

      FlattenColumn flattenColumn = FlattenColumn.builder().name(columnName).description(col.getDescription()).build();

      if (!tags.isEmpty()) {
        flattenColumn.tags = tags;
      }
      flattenColumns.add(flattenColumn);
      if (col.getChildren() != null) {
        parseColumns(col.getChildren(), flattenColumns, col.getName());
      }
    }
  }
}
