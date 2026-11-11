/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.databases;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.schema.type.TableType;

public final class DatabaseUtil {
  private DatabaseUtil() {}

  public static void validateTableSharding(Table table) {
    var sharding = table.getTableSharding();
    if ((table.getTableType() == TableType.Sharded) != (sharding != null)) {
      throw new IllegalArgumentException(
          "Sharded tables require tableSharding; other table types cannot carry it");
    }
    if (sharding == null) return;
    var source = sharding.getRepresentative();
    if (source == null
        || nullOrEmpty(source.getDatabaseName())
        || nullOrEmpty(source.getSchemaName())
        || nullOrEmpty(source.getTableName())
        || sharding.getSuffixFormat() == null
        || source.getShardDate() == null
        || sharding.getFirstShardDate() == null
        || sharding.getLastShardDate() == null
        || sharding.getShardCount() == null
        || sharding.getPrefix() == null) {
      throw new IllegalArgumentException(
          "Sharding requires complete source names, dates, suffix format, count and prefix");
    }
    var first = parseShardDate(sharding.getFirstShardDate());
    var last = parseShardDate(sharding.getLastShardDate());
    if (first.getYear() < 1
        || last.getYear() > 9999
        || first.isAfter(last)
        || !last.equals(parseShardDate(source.getShardDate()))
        || sharding.getShardCount() < 1
        || sharding.getShardCount() > last.toEpochDay() - first.toEpochDay() + 1
        || (sharding.getShardCount() == 1 && !first.equals(last))) {
      throw new IllegalArgumentException(
          "Inconsistent shard count, date range or representative date");
    }
    String prefix = sharding.getPrefix();
    if (prefix.contains("$")
        || (!prefix.isEmpty()
            && prefix.charAt(prefix.length() - 1) >= '0'
            && prefix.charAt(prefix.length() - 1) <= '9')
        || !table.getName().equals(prefix + "yyyymmdd")
        || !source.getTableName().equals(prefix + last.format(DateTimeFormatter.BASIC_ISO_DATE))) {
      throw new IllegalArgumentException(
          "Sharding names must preserve the exact daily family prefix");
    }
  }

  private static LocalDate parseShardDate(String value) {
    try {
      return LocalDate.parse(value);
    } catch (DateTimeParseException exception) {
      throw new IllegalArgumentException("Shard dates must be valid ISO calendar dates", exception);
    }
  }

  public static boolean validateSinglePrimaryColumn(List<Column> columns) {
    int primaryKeyColumns = 0;
    for (Column c : columns) {
      if (c.getConstraint() == ColumnConstraint.PRIMARY_KEY) {
        primaryKeyColumns++;
        if (primaryKeyColumns > 1) {
          throw new IllegalArgumentException(
              "Multiple columns tagged with primary key constraints");
        }
      }
    }
    return primaryKeyColumns == 1;
  }

  /** Validate column and table constraints */
  public static void validateConstraints(
      List<Column> columns, List<TableConstraint> tableConstraints) {
    boolean primaryColumnExists = validateSinglePrimaryColumn(columns);
    if (tableConstraints == null) {
      return;
    }

    // Validate table constraint
    List<String> columnNames = new ArrayList<>();
    columns.forEach(c -> columnNames.add(c.getName()));
    for (TableConstraint t : tableConstraints) {
      if (t.getConstraintType() == TableConstraint.ConstraintType.PRIMARY_KEY
          && primaryColumnExists) {
        throw new IllegalArgumentException(
            "A column already tagged as a primary key and table constraint also includes primary key");
      }
      for (String columnName : t.getColumns()) {
        if (!columnNames.contains(columnName)) {
          throw new IllegalArgumentException("Invalid column name found in table constraint");
        }
      }
    }
  }

  /** Validate Table partition */
  public static void validateTablePartition(List<Column> columns, TablePartition tablePartition) {
    if (tablePartition == null || nullOrEmpty(tablePartition.getColumns())) {
      return;
    }
    List<String> columnNames = new ArrayList<>();
    columns.forEach(c -> columnNames.add(c.getName()));
    // Add BigQuery partition pseudo columns
    columnNames.add("_PARTITIONDATE");
    columnNames.add("_PARTITIONTIME");
    for (PartitionColumnDetails partitionColumnDetails : tablePartition.getColumns()) {
      if (!columnNames.contains(partitionColumnDetails.getColumnName())) {
        throw new IllegalArgumentException("Invalid column name found in table partition");
      }
    }
  }

  public static void validateColumns(List<Column> columns) {
    validateColumnNames(columns);
    for (Column c : columns) {
      validateColumnDataTypeDisplay(c);
      validateColumnDataLength(c);
      validateArrayColumn(c);
      validateStructColumn(c);
      validatePrecisionAndScale(c);
    }
  }

  public static void validateColumnNames(List<Column> columns) {
    List<String> columnNames = new ArrayList<>();
    for (Column c : columns) {
      if (columnNames.contains(c.getName())) {
        throw new IllegalArgumentException(
            String.format("Column name %s is repeated", c.getName()));
      }
      columnNames.add(c.getName());
    }
  }

  public static void validateColumnDataTypeDisplay(Column column) {
    // If dataTypeDisplay is null then set it based on dataType
    if (column.getDataTypeDisplay() == null) {
      column.setDataTypeDisplay(column.getDataType().value().toLowerCase(Locale.ROOT));
    }

    // Make sure types from column dataType and dataTypeDisplay match
    String dataTypeDisplay = column.getDataTypeDisplay().toLowerCase(Locale.ROOT);

    column.setDataTypeDisplay(dataTypeDisplay); // Make dataTypeDisplay lower case
  }

  public static void validateColumnDataLength(Column column) {
    // Types char, varchar, binary, varbinary must have dataLength
    ColumnDataType dataType = column.getDataType();
    if ((dataType == ColumnDataType.CHAR
            || dataType == ColumnDataType.VARCHAR
            || dataType == ColumnDataType.BINARY
            || dataType == ColumnDataType.VARBINARY)
        && column.getDataLength() == null) {
      throw new IllegalArgumentException(
          "For column data types char, varchar, binary, varbinary dataLength must not be null");
    }
  }

  public static void validateArrayColumn(Column column) {
    // arrayDataType must only be used when columnDataType is array. Ignore the arrayDataType.
    ColumnDataType dataType = column.getDataType();
    if (column.getArrayDataType() != null && dataType != ColumnDataType.ARRAY) {
      column.setArrayDataType(null);
    }

    if (dataType == ColumnDataType.ARRAY && (column.getArrayDataType() == null)) {
      throw new IllegalArgumentException(
          "For column data type array, arrayDataType must not be null");
    }
  }

  public static void validateStructColumn(Column column) {
    ColumnDataType dataType = column.getDataType();
    if (dataType == ColumnDataType.STRUCT) {
      if (column.getChildren() == null) {
        throw new IllegalArgumentException(
            "For column data type struct, children must not be null");
      }

      validateColumnNames(column.getChildren());
    }
  }

  public static void validatePrecisionAndScale(Column column) {
    if (column.getScale() == null && column.getPrecision() == null) {
      return;
    }
    if (column.getScale() != null) {
      if (column.getPrecision() == null) {
        throw new IllegalArgumentException(
            "Scale is set but precision is not set for the column " + column.getName());
      }
      if (column.getScale() > column.getPrecision()) {
        throw new IllegalArgumentException(
            "Scale can't be greater than the precision for the column " + column.getName());
      }
    }
  }
}
