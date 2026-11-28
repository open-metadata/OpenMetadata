/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.fernet.rotation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;

/**
 * The tables and columns of the current schema that can hold a token, read from {@code
 * information_schema} at every run, so a table a release or a distribution adds is read without
 * anyone listing it. A column is eligible by type (JSON, text, character, binary), when it is not
 * generated (the database recomputes those from the column that is rewritten) and when its declared
 * maximum is at least {@value #MIN_LENGTH} characters: the shortest token the server writes is 107.
 * On PostgreSQL, attached child partitions are excluded so partitioned tables are read once via
 * their parent and skipped when the parent is in {@link LargeTables}.
 */
final class SqlCatalog {
  static final int MIN_LENGTH = 100;
  private static final Set<String> UNSUITABLE_NARROWING_TYPES =
      Set.of(
          "json",
          "jsonb",
          "bytea",
          "binary",
          "varbinary",
          "tinyblob",
          "blob",
          "mediumblob",
          "longblob",
          "text",
          "tinytext",
          "mediumtext",
          "longtext");

  enum ColumnType {
    JSON,
    JSONB,
    TEXT,
    BYTES;

    Encoding encoding() {
      return switch (this) {
        case JSON, JSONB -> Encoding.JSON;
        case TEXT -> Encoding.TEXT;
        case BYTES -> Encoding.BYTES;
      };
    }
  }

  record SqlColumn(String name, ColumnType type) {}

  /**
   * A base table with at least one eligible column; {@code primaryKey} is in ordinal order, and
   * {@code narrowingColumns} holds indexed non-token scalar columns used to narrow compare-and-set
   * updates on tables without a primary key.
   */
  record SqlTable(
      String name,
      List<String> primaryKey,
      List<String> narrowingColumns,
      List<SqlColumn> columns) {
    SqlTable(String name, List<String> primaryKey, List<SqlColumn> columns) {
      this(name, primaryKey, List.of(), columns);
    }

    SqlTable {
      primaryKey = List.copyOf(primaryKey);
      narrowingColumns = List.copyOf(narrowingColumns);
      columns = List.copyOf(columns);
    }

    boolean hasPrimaryKey() {
      return !primaryKey.isEmpty();
    }

    boolean hasColumn(String column) {
      return columnName(column).isPresent();
    }

    Optional<String> columnName(String column) {
      return columns.stream()
          .map(SqlColumn::name)
          .filter(it -> it.equalsIgnoreCase(column))
          .findFirst()
          .or(() -> primaryKey.stream().filter(it -> it.equalsIgnoreCase(column)).findFirst());
    }

    Optional<SqlColumn> column(String name) {
      return columns.stream().filter(it -> it.name().equals(name)).findFirst();
    }
  }

  private record RawColumn(
      String table, String column, String dataType, Long maxLength, String generated) {}

  private SqlCatalog() {}

  static List<SqlTable> read(Handle handle, Dialect dialect) {
    Map<String, List<String>> keys = primaryKeys(handle, dialect);
    Map<String, LinkedHashSet<String>> indexed = indexedColumns(handle, dialect);
    Map<String, Map<String, String>> rawTypes = new LinkedHashMap<>();
    Map<String, List<SqlColumn>> columns = new LinkedHashMap<>();
    for (RawColumn raw : columns(handle, dialect)) {
      rawTypes
          .computeIfAbsent(raw.table(), table -> new LinkedHashMap<>())
          .put(raw.column(), raw.dataType().toLowerCase(Locale.ROOT));
      eligible(raw, dialect)
          .ifPresent(
              type ->
                  columns
                      .computeIfAbsent(raw.table(), table -> new ArrayList<>())
                      .add(new SqlColumn(raw.column(), type)));
    }
    return columns.entrySet().stream()
        .map(
            entry -> {
              String table = entry.getKey();
              List<String> primaryKey = keys.getOrDefault(table, List.of());
              List<String> narrowing =
                  primaryKey.isEmpty()
                      ? narrowingColumnsOf(
                          indexed.getOrDefault(table, new LinkedHashSet<>()),
                          rawTypes.getOrDefault(table, Map.of()),
                          entry.getValue())
                      : List.of();
              return new SqlTable(table, primaryKey, narrowing, entry.getValue());
            })
        .toList();
  }

  static List<String> narrowingColumnsOf(
      Set<String> indexed, Map<String, String> columnDataTypes, List<SqlColumn> eligibleColumns) {
    Set<String> tokenColumns =
        eligibleColumns.stream().map(SqlColumn::name).collect(Collectors.toSet());
    return indexed.stream()
        .filter(col -> !tokenColumns.contains(col))
        .filter(
            col -> {
              String type = columnDataTypes.get(col);
              return type != null && !UNSUITABLE_NARROWING_TYPES.contains(type);
            })
        .toList();
  }

  private static Optional<ColumnType> eligible(RawColumn raw, Dialect dialect) {
    boolean generated = raw.generated() != null && dialect.isGenerated(raw.generated());
    boolean wideEnough = raw.maxLength() == null || raw.maxLength() >= MIN_LENGTH;
    return generated || !wideEnough
        ? Optional.empty()
        : dialect.columnType(raw.dataType().toLowerCase(Locale.ROOT));
  }

  private static List<RawColumn> columns(Handle handle, Dialect dialect) {
    return handle
        .createQuery(
            "SELECT c.table_name, c.column_name, c.data_type, c.character_maximum_length, "
                + dialect.generatedColumn()
                + " FROM information_schema.columns c"
                + " JOIN information_schema.tables t"
                + " ON t.table_schema = c.table_schema AND t.table_name = c.table_name"
                + " WHERE c.table_schema = "
                + dialect.currentSchema()
                + " AND t.table_type = 'BASE TABLE'"
                + dialect.tableFilter()
                + " ORDER BY c.table_name, c.ordinal_position")
        .map(
            (rs, ctx) ->
                new RawColumn(
                    rs.getString(1),
                    rs.getString(2),
                    rs.getString(3),
                    rs.getObject(4) == null ? null : rs.getLong(4),
                    rs.getString(5)))
        .list();
  }

  private static Map<String, List<String>> primaryKeys(Handle handle, Dialect dialect) {
    Map<String, List<String>> keys = new LinkedHashMap<>();
    handle
        .createQuery(dialect.primaryKeysSql())
        .map((rs, ctx) -> List.of(rs.getString(1), rs.getString(2)))
        .forEach(
            row ->
                keys.computeIfAbsent(row.getFirst(), table -> new ArrayList<>())
                    .add(row.getLast()));
    return keys;
  }

  private static Map<String, LinkedHashSet<String>> indexedColumns(Handle handle, Dialect dialect) {
    Map<String, LinkedHashSet<String>> indexed = new LinkedHashMap<>();
    handle
        .createQuery(dialect.indexedColumnsSql())
        .map((rs, ctx) -> List.of(rs.getString(1), rs.getString(2)))
        .forEach(
            row ->
                indexed
                    .computeIfAbsent(row.getFirst(), table -> new LinkedHashSet<>())
                    .add(row.getLast()));
    return indexed;
  }
}
