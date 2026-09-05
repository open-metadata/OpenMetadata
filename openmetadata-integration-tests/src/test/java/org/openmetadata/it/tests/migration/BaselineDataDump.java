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
package org.openmetadata.it.tests.migration;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HexFormat;
import java.util.List;
import java.util.StringJoiner;
import org.openmetadata.it.tests.migration.BaselineScratchSupport.ScratchDatabase;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Renders the seed rows a chain install leaves behind as deterministic, idempotent INSERT
 * statements ({@code INSERT IGNORE} / {@code ON CONFLICT DO NOTHING}), ordered by every column so
 * regeneration is stable. Used instead of the native dump tools for data because neither
 * mysqldump nor pg_dump can guarantee deterministic row order across runs.
 */
class BaselineDataDump {

  private final ScratchDatabase database;
  private final ConnectionType connectionType;
  private final boolean mysql;

  BaselineDataDump(ScratchDatabase database, ConnectionType connectionType) {
    this.database = database;
    this.connectionType = connectionType;
    this.mysql = connectionType == ConnectionType.MYSQL;
  }

  String render(List<String> includedTables) {
    StringBuilder result = new StringBuilder();
    for (String table : includedTables) {
      String tableInserts = renderTable(table);
      if (!tableInserts.isEmpty()) {
        result.append("-- ").append(table).append('\n').append(tableInserts).append('\n');
      }
    }
    return result.toString();
  }

  private String renderTable(String table) {
    List<String> columns = listColumns(table);
    List<String> inserts =
        database
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .select(selectAllQuery(table, columns))
                        .map((rs, ctx) -> renderInsert(table, columns, rs))
                        .list());
    return String.join("", inserts);
  }

  /** Generated columns are excluded — inserting into them is rejected by both dialects. */
  private List<String> listColumns(String table) {
    String query =
        mysql
            ? "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = :tableName AND extra NOT LIKE '%GENERATED%' ORDER BY ordinal_position"
            : "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = :tableName AND is_generated = 'NEVER' ORDER BY ordinal_position";
    return database
        .jdbi()
        .withHandle(
            handle ->
                handle.createQuery(query).bind("tableName", table).mapTo(String.class).list());
  }

  private String selectAllQuery(String table, List<String> columns) {
    StringJoiner columnList = new StringJoiner(", ");
    StringJoiner orderList = new StringJoiner(", ");
    for (String column : columns) {
      String quoted = quoteIdentifier(column);
      columnList.add(quoted);
      // Postgres `json` (unlike jsonb) has no ordering operator; text order is just as
      // deterministic, which is all the dump needs.
      orderList.add(mysql ? quoted : "CAST(" + quoted + " AS TEXT)");
    }
    return "SELECT %s FROM %s ORDER BY %s".formatted(columnList, quoteIdentifier(table), orderList);
  }

  private String renderInsert(String table, List<String> columns, ResultSet resultSet) {
    StringJoiner columnList = new StringJoiner(", ");
    columns.forEach(column -> columnList.add(quoteIdentifier(column)));
    StringJoiner values = new StringJoiner(", ");
    try {
      for (int i = 1; i <= columns.size(); i++) {
        values.add(renderValue(resultSet, i));
      }
    } catch (SQLException e) {
      throw new IllegalStateException("Failed to render row of table " + table, e);
    }
    String template =
        mysql
            ? "INSERT IGNORE INTO %s (%s) VALUES (%s);%n"
            : "INSERT INTO %s (%s) VALUES (%s) ON CONFLICT DO NOTHING;%n";
    return template.formatted(quoteIdentifier(table), columnList, values);
  }

  private String renderValue(ResultSet resultSet, int index) throws SQLException {
    Object value = resultSet.getObject(index);
    String result;
    if (value == null) {
      result = "NULL";
    } else if (value instanceof Number number) {
      result = number.toString();
    } else if (value instanceof Boolean bool) {
      result = bool ? "TRUE" : "FALSE";
    } else if (value instanceof byte[] bytes) {
      result = renderBytes(bytes);
    } else {
      result = quoteLiteral(resultSet.getString(index));
    }
    return result;
  }

  private String renderBytes(byte[] bytes) {
    String hex = HexFormat.of().formatHex(bytes);
    return mysql ? "0x" + hex : "'\\x" + hex + "'";
  }

  private String quoteLiteral(String value) {
    String escaped = value.replace("'", "''");
    if (mysql) {
      escaped = value.replace("\\", "\\\\").replace("'", "''");
    }
    return "'" + escaped + "'";
  }

  private String quoteIdentifier(String identifier) {
    return mysql ? "`" + identifier + "`" : "\"" + identifier + "\"";
  }
}
