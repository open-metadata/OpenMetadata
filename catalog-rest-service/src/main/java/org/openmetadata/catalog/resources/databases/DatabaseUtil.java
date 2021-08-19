/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.databases;

import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnConstraint;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.TableType;

import java.util.ArrayList;
import java.util.List;

public final class DatabaseUtil {
  private DatabaseUtil() {

  }

  public static boolean validateSinglePrimaryColumn(List<Column> columns) {
    int primaryKeyColumns = 0;
    for (Column c : columns) {
      if (c.getColumnConstraint() == ColumnConstraint.PRIMARY_KEY) {
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
    if ( (tableType == null || tableType.equals(TableType.Regular) || tableType.equals(TableType.External))
            && viewDefinition != null && !viewDefinition.isEmpty()) {
      throw new IllegalArgumentException("ViewDefinition can only be set on TableType View, " +
              "SecureView or MaterializedView");
    }
  }
}
