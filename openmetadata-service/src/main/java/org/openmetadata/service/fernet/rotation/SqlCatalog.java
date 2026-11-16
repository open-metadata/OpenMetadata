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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.jdbi.v3.core.Handle;

/**
 * The tables and columns of the current schema that can hold a token, read from {@code
 * information_schema} at every run, so a table a release or a distribution adds is read without
 * anyone listing it. A column is eligible by type (JSON, text, character, binary), when it is not
 * generated (the database recomputes those from the column that is rewritten) and when its declared
 * maximum is at least {@value #MIN_LENGTH} characters: the shortest token the server writes is 107.
 */
final class SqlCatalog {
  static final int MIN_LENGTH = 100;
  private static final String VIRTUAL_GENERATED = "virtual generated";
  private static final String STORED_GENERATED = "stored generated";
  private static final String ALWAYS = "always";

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

  /** A base table with at least one eligible column; {@code primaryKey} is in ordinal order. */
  record SqlTable(String name, List<String> primaryKey, List<SqlColumn> columns) {
    SqlTable {
      primaryKey = List.copyOf(primaryKey);
      columns = List.copyOf(columns);
    }

    boolean hasPrimaryKey() {
      return !primaryKey.isEmpty();
    }

    boolean hasColumn(String column) {
      return columns.stream().anyMatch(it -> it.name().equalsIgnoreCase(column))
          || primaryKey.stream().anyMatch(it -> it.equalsIgnoreCase(column));
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
    Map<String, List<SqlColumn>> columns = new LinkedHashMap<>();
    for (RawColumn raw : columns(handle, dialect)) {
      eligible(raw, dialect)
          .ifPresent(
              type ->
                  columns
                      .computeIfAbsent(raw.table(), table -> new ArrayList<>())
                      .add(new SqlColumn(raw.column(), type)));
    }
    return columns.entrySet().stream()
        .map(
            entry ->
                new SqlTable(
                    entry.getKey(), keys.getOrDefault(entry.getKey(), List.of()), entry.getValue()))
        .toList();
  }

  private static Optional<ColumnType> eligible(RawColumn raw, Dialect dialect) {
    boolean generated = raw.generated() != null && isGenerated(raw.generated(), dialect);
    boolean wideEnough = raw.maxLength() == null || raw.maxLength() >= MIN_LENGTH;
    return generated || !wideEnough
        ? Optional.empty()
        : dialect.columnType(raw.dataType().toLowerCase(Locale.ROOT));
  }

  // MySQL reports DEFAULT_GENERATED for an expression default, a column the database does not
  // recompute, so only the VIRTUAL and STORED forms count.
  private static boolean isGenerated(String marker, Dialect dialect) {
    String lower = marker.toLowerCase(Locale.ROOT);
    return dialect == Dialect.MYSQL
        ? lower.contains(VIRTUAL_GENERATED) || lower.contains(STORED_GENERATED)
        : lower.equals(ALWAYS);
  }

  // MySQL marks a generated column in EXTRA ("VIRTUAL GENERATED"); PostgreSQL in is_generated.
  private static List<RawColumn> columns(Handle handle, Dialect dialect) {
    String generated = dialect == Dialect.MYSQL ? "c.extra" : "c.is_generated";
    return handle
        .createQuery(
            "SELECT c.table_name, c.column_name, c.data_type, c.character_maximum_length, "
                + generated
                + " FROM information_schema.columns c"
                + " JOIN information_schema.tables t"
                + " ON t.table_schema = c.table_schema AND t.table_name = c.table_name"
                + " WHERE c.table_schema = "
                + dialect.currentSchema()
                + " AND t.table_type = 'BASE TABLE'"
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
    String sql =
        dialect == Dialect.MYSQL
            ? "SELECT table_name, column_name FROM information_schema.key_column_usage"
                + " WHERE table_schema = DATABASE() AND constraint_name = 'PRIMARY'"
                + " ORDER BY table_name, ordinal_position"
            : "SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc"
                + " JOIN information_schema.key_column_usage kcu"
                + " ON kcu.constraint_schema = tc.constraint_schema"
                + " AND kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name"
                + " WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'PRIMARY KEY'"
                + " ORDER BY tc.table_name, kcu.ordinal_position";
    Map<String, List<String>> keys = new LinkedHashMap<>();
    handle
        .createQuery(sql)
        .map((rs, ctx) -> List.of(rs.getString(1), rs.getString(2)))
        .forEach(
            row ->
                keys.computeIfAbsent(row.getFirst(), table -> new ArrayList<>())
                    .add(row.getLast()));
    return keys;
  }
}
