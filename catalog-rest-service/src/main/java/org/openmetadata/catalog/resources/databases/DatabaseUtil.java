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

package org.openmetadata.catalog.resources.databases;

import org.openmetadata.catalog.entity.data.DbtModel;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnConstraint;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.TableType;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class DatabaseUtil {
  private DatabaseUtil() {

  }

  public static boolean validateSinglePrimaryColumn(List<Column> columns) {
    int primaryKeyColumns = 0;
    for (Column c : columns) {
      if (c.getConstraint() == ColumnConstraint.PRIMARY_KEY) {
        primaryKeyColumns++;
        if (primaryKeyColumns > 1) {
          throw new IllegalArgumentException("Multiple columns tagged with primary key constraints");
        }
      }
    }
    return primaryKeyColumns == 1;
  }

  /**
   * Validate column and table constraints
   */
  public static void validateConstraints(List<Column> columns, List<TableConstraint> tableConstraints) {
    boolean primaryColumnExists = validateSinglePrimaryColumn(columns);
    if (tableConstraints == null) {
      return;
    }

    // Validate table constraint
    List<String> columnNames = new ArrayList<>();
    columns.forEach(c -> columnNames.add(c.getName()));
    for (TableConstraint t : tableConstraints) {
      if (t.getConstraintType() == TableConstraint.ConstraintType.PRIMARY_KEY && primaryColumnExists) {
        throw new IllegalArgumentException("A column already tagged as a primary key and table constraint also " +
                "includes primary key");
      }
      for (String columnName : t.getColumns()) {
        if (!columnNames.contains(columnName)) {
          throw new IllegalArgumentException("Invalid column name found in table constraint");
        }
      }
    }
  }

  public static void validateViewDefinition(TableType tableType, String viewDefinition) {
    if ((tableType == null || tableType.equals(TableType.Regular) || tableType.equals(TableType.External))
            && viewDefinition != null && !viewDefinition.isEmpty()) {
      throw new IllegalArgumentException("ViewDefinition can only be set on TableType View, " +
              "SecureView or MaterializedView");
    }
  }

  public static void validateColumns(Table table) {
    validateColumnNames(table.getColumns());
    for (Column c : table.getColumns()) {
      validateColumnDataTypeDisplay(c);
      validateColumnDataLength(c);
      validateArrayColumn(c);
      validateStructColumn(c);
    }
  }

  public static void validateColumns(DbtModel dbtModel) {
    validateColumnNames(dbtModel.getColumns());
    for (Column c : dbtModel.getColumns()) {
      validateColumnDataTypeDisplay(c);
      validateColumnDataLength(c);
      validateArrayColumn(c);
      validateStructColumn(c);
    }
  }

  public static void validateColumnNames(List<Column> columns) {
    List<String> columnNames = new ArrayList<>();
    for (Column c : columns) {
      if (columnNames.contains(c.getName())) {
        throw new IllegalArgumentException(String.format("Column name %s is repeated", c.getName()));
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
    String dataType = column.getDataType().value().toLowerCase(Locale.ROOT);
    String dataTypeDisplay = column.getDataTypeDisplay().toLowerCase(Locale.ROOT);

    if (!dataTypeDisplay.startsWith(dataType)) {
      throw new IllegalArgumentException(String.format("columnDataType %s does not match columnDataTypeDisplay %s",
              dataType, dataTypeDisplay));
    }

    column.setDataTypeDisplay(dataTypeDisplay); // Make dataTypeDisplay lower case
  }

  public static void validateColumnDataLength(Column column) {
    // Types char, varchar, binary, varbinary must have dataLength
    ColumnDataType dataType = column.getDataType();
    if ((dataType == ColumnDataType.CHAR || dataType == ColumnDataType.VARCHAR ||
            dataType == ColumnDataType.BINARY || dataType == ColumnDataType.VARBINARY) && column.getDataLength() == null) {
      throw new IllegalArgumentException("For column data types char, varchar, binary, varbinary dataLength " +
              "must not be null");
    }
  }

  public static void validateArrayColumn(Column column) {
    // arrayDataType must only be used when columnDataType is array. Ignore the arrayDataType.
    ColumnDataType dataType = column.getDataType();
    if (column.getArrayDataType() != null && dataType != ColumnDataType.ARRAY) {
      column.setArrayDataType(null);
    }

    if (dataType == ColumnDataType.ARRAY) {
      if (column.getArrayDataType() == null) {
        throw new IllegalArgumentException("For column data type array, arrayDataType " +
                "must not be null");
      }

      if (!column.getDataTypeDisplay().startsWith("array<")) {
        throw new IllegalArgumentException("For column data type array, dataTypeDisplay must be of type " +
                "array<arrayDataType>");
      }
    }
  }

  public static void validateStructColumn(Column column) {
    ColumnDataType dataType = column.getDataType();
    if (dataType == ColumnDataType.STRUCT) {
      if (column.getChildren() == null) {
        throw new IllegalArgumentException("For column data type struct, children " +
                "must not be null");
      }

      validateColumnNames(column.getChildren());
      if (!column.getDataTypeDisplay().startsWith("struct<")) {
        throw new IllegalArgumentException("For column data type struct, dataTypeDisplay must be of type " +
                "struct<member fields>");
      }
    }
  }
}
