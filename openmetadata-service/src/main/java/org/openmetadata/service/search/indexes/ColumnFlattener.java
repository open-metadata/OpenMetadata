/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.models.FlattenColumn;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Flattens recursive columns (struct children) into a flat list, bounded by the configured depth and
 * column-count limits so a pathologically deep or wide table can never explode the search document.
 * Shared by the column-bearing indexes through {@link ColumnIndex#parseColumns} and by vector chunk
 * documents, which carry the same column tags, the column counterpart of {@link
 * SchemaFieldFlattener}.
 */
public final class ColumnFlattener {

  private static final Logger LOG = LoggerFactory.getLogger(ColumnFlattener.class);

  private ColumnFlattener() {}

  public static void parseColumns(
      List<Column> columns, List<FlattenColumn> flattenColumns, String parentColumn) {
    parseColumns(columns, flattenColumns, parentColumn, 1, SearchFieldLimits.active());
  }

  private static void parseColumns(
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

  private static void addColumnsWithinLimit(
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

  private static String addFlattenColumn(
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
}
