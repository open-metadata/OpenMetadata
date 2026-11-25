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

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.fernet.rotation.SqlCatalog.ColumnType;
import org.openmetadata.service.fernet.rotation.SqlCatalog.SqlColumn;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Every SQL fragment that differs between MySQL and PostgreSQL. */
enum Dialect {
  MYSQL(
      "DATABASE()",
      '`',
      "c.extra",
      "SELECT table_name, column_name FROM information_schema.key_column_usage"
          + " WHERE table_schema = DATABASE() AND constraint_name = 'PRIMARY'"
          + " ORDER BY table_name, ordinal_position",
      Map.ofEntries(
          Map.entry("json", ColumnType.JSON),
          Map.entry("char", ColumnType.TEXT),
          Map.entry("varchar", ColumnType.TEXT),
          Map.entry("tinytext", ColumnType.TEXT),
          Map.entry("text", ColumnType.TEXT),
          Map.entry("mediumtext", ColumnType.TEXT),
          Map.entry("longtext", ColumnType.TEXT),
          Map.entry("binary", ColumnType.BYTES),
          Map.entry("varbinary", ColumnType.BYTES),
          Map.entry("tinyblob", ColumnType.BYTES),
          Map.entry("blob", ColumnType.BYTES),
          Map.entry("mediumblob", ColumnType.BYTES),
          Map.entry("longblob", ColumnType.BYTES))) {
    // MySQL reports DEFAULT_GENERATED for an expression default, a column the database does not
    // recompute, so only the VIRTUAL and STORED forms count.
    @Override
    boolean isGenerated(String marker) {
      String lower = marker.toLowerCase(Locale.ROOT);
      return lower.contains("virtual generated") || lower.contains("stored generated");
    }

    @Override
    String asText(SqlColumn column) {
      return column.type() == ColumnType.BYTES
          ? quote(column.name())
          : "CAST(" + quote(column.name()) + " AS CHAR)";
    }

    @Override
    String holdsToken(SqlColumn column) {
      return column.type() == ColumnType.BYTES
          ? "LOCATE('" + Fernet.FERNET_PREFIX + "', " + quote(column.name()) + ") > 0"
          : asText(column) + " LIKE '%" + Fernet.FERNET_PREFIX + "%'";
    }

    @Override
    String sameAs(SqlColumn column, String param) {
      String name = quote(column.name());
      return switch (column.type()) {
        case JSON, JSONB -> name + " = CAST(:" + param + " AS JSON)";
        case TEXT -> "CAST(" + name + " AS BINARY) = CAST(:" + param + " AS BINARY)";
        case BYTES -> name + " = :" + param;
      };
    }

    @Override
    String value(SqlColumn column, String param) {
      return column.type() == ColumnType.BYTES || column.type() == ColumnType.TEXT
          ? ":" + param
          : "CAST(:" + param + " AS JSON)";
    }

    // Expanded so the range access on the key stays: a > :a OR (a = :a AND b > :b) ...
    @Override
    String after(List<String> key, String paramPrefix) {
      return IntStream.range(0, key.size())
          .mapToObj(
              last -> {
                String equalBefore =
                    IntStream.range(0, last)
                        .mapToObj(i -> quote(key.get(i)) + " = :" + paramPrefix + i)
                        .collect(Collectors.joining(" AND "));
                String greater = quote(key.get(last)) + " > :" + paramPrefix + last;
                return "("
                    + (equalBefore.isEmpty() ? greater : equalBefore + " AND " + greater)
                    + ")";
              })
          .collect(Collectors.joining(" OR ", "(", ")"));
    }
  },
  POSTGRES(
      "current_schema()",
      '"',
      "c.is_generated",
      "SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc"
          + " JOIN information_schema.key_column_usage kcu"
          + " ON kcu.constraint_schema = tc.constraint_schema"
          + " AND kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name"
          + " WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'PRIMARY KEY'"
          + " ORDER BY tc.table_name, kcu.ordinal_position",
      Map.of(
          "json", ColumnType.JSON,
          "jsonb", ColumnType.JSONB,
          "text", ColumnType.TEXT,
          "character varying", ColumnType.TEXT,
          "character", ColumnType.TEXT,
          "bytea", ColumnType.BYTES)) {
    @Override
    boolean isGenerated(String marker) {
      return "always".equalsIgnoreCase(marker);
    }

    @Override
    String asText(SqlColumn column) {
      String name = quote(column.name());
      return switch (column.type()) {
        case JSON, JSONB -> name + "::text";
        case TEXT, BYTES -> name;
      };
    }

    @Override
    String holdsToken(SqlColumn column) {
      return column.type() == ColumnType.BYTES
          ? "position('\\x" + FERNET_PREFIX_HEX + "'::bytea in " + quote(column.name()) + ") > 0"
          : asText(column) + " LIKE '%" + Fernet.FERNET_PREFIX + "%'";
    }

    @Override
    String sameAs(SqlColumn column, String param) {
      String name = quote(column.name());
      return switch (column.type()) {
        case JSONB -> name + " = CAST(:" + param + " AS jsonb)";
        case JSON -> name + "::text = :" + param;
        case TEXT, BYTES -> name + " = :" + param;
      };
    }

    @Override
    String value(SqlColumn column, String param) {
      return switch (column.type()) {
        case JSONB -> "CAST(:" + param + " AS jsonb)";
        case JSON -> "CAST(:" + param + " AS json)";
        case TEXT, BYTES -> ":" + param;
      };
    }

    @Override
    String after(List<String> key, String paramPrefix) {
      String columns = key.stream().map(this::quote).collect(Collectors.joining(", "));
      String params =
          IntStream.range(0, key.size())
              .mapToObj(i -> ":" + paramPrefix + i)
              .collect(Collectors.joining(", "));
      return key.size() == 1 ? columns + " > " + params : "(" + columns + ") > (" + params + ")";
    }
  };

  private static final String FERNET_PREFIX_HEX = "6665726e65743a";

  private final String currentSchema;
  private final char quoteChar;
  private final String generatedColumn;
  private final String primaryKeysSql;
  private final Map<String, ColumnType> columnTypes;

  Dialect(
      String currentSchema,
      char quoteChar,
      String generatedColumn,
      String primaryKeysSql,
      Map<String, ColumnType> columnTypes) {
    this.currentSchema = currentSchema;
    this.quoteChar = quoteChar;
    this.generatedColumn = generatedColumn;
    this.primaryKeysSql = primaryKeysSql;
    this.columnTypes = columnTypes;
  }

  static Dialect of(ConnectionType type) {
    return switch (type) {
      case MYSQL -> MYSQL;
      case POSTGRES -> POSTGRES;
    };
  }

  /** The SQL expression for the schema the connection is in. */
  String currentSchema() {
    return currentSchema;
  }

  /** The {@code information_schema.columns} column that marks generated columns. */
  String generatedColumn() {
    return generatedColumn;
  }

  /** The query returning {@code (table_name, column_name)} pairs for all primary keys in order. */
  String primaryKeysSql() {
    return primaryKeysSql;
  }

  /** Whether the non-null {@link #generatedColumn()} marker denotes a generated column. */
  abstract boolean isGenerated(String marker);

  String quote(String identifier) {
    String q = String.valueOf(quoteChar);
    return q + identifier.replace(q, q + q) + q;
  }

  /** The kind of text a column of this {@code information_schema} data type holds, if any. */
  Optional<ColumnType> columnType(String dataType) {
    return Optional.ofNullable(columnTypes.get(dataType));
  }

  /** The column as text, the form the rotation reads and compares. */
  abstract String asText(SqlColumn column);

  /** A boolean SQL expression: the column holds the text {@code fernet:}. */
  abstract String holdsToken(SqlColumn column);

  /** The column's text when it holds a token, else NULL, so only token-holding cells travel. */
  String cellIfFlagged(SqlColumn column) {
    return "CASE WHEN " + holdsToken(column) + " THEN " + asText(column) + " END";
  }

  /** A boolean SQL expression: the column still holds the value bound to {@code param}. */
  abstract String sameAs(SqlColumn column, String param);

  /** The value bound to {@code param} as something the column can be set to. */
  abstract String value(SqlColumn column, String param);

  /** A boolean SQL expression: the row's key comes after the key bound to the prefixed params. */
  abstract String after(List<String> key, String paramPrefix);
}
