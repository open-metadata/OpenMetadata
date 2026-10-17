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

package org.openmetadata.service.projection;

import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * A membership row that a point write determines from its own arguments. It needs no read before or
 * after the write, so the capture buffer retains it at commit under one header per kind instead of
 * the write paying for a header, a guard and snapshot reads of its own.
 */
record BufferedMembership(Table table, List<Object> values) {
  private static final int INSERT_PAGE_SIZE = 500;

  BufferedMembership {
    if (values.size() != table.columns().size()) {
      throw new IllegalArgumentException(
          table + " membership requires " + table.columns().size() + " values");
    }
    values = Collections.unmodifiableList(new ArrayList<>(values));
  }

  int estimateBytes() {
    int bytes = 64;
    for (final Object value : values) {
      bytes +=
          switch (value) {
            case String text -> text.length() * Character.BYTES;
            case JsonText json -> json.text() == null ? 0 : json.text().length() * Character.BYTES;
            case null -> Long.BYTES;
            default -> Long.BYTES;
          };
    }
    return bytes;
  }

  /** Inserts every row of one table under its header in bounded multi-row statements. */
  static void insert(
      final Handle handle,
      final Table table,
      final long header,
      final List<BufferedMembership> rows) {
    for (int offset = 0; offset < rows.size(); offset += INSERT_PAGE_SIZE) {
      final List<BufferedMembership> page =
          rows.subList(offset, Math.min(rows.size(), offset + INSERT_PAGE_SIZE));
      final int width = table.columns().size() + 1;
      final Update insert =
          handle.createUpdate(
              "INSERT INTO "
                  + table.snapshotTable()
                  + " (mutationId, "
                  + String.join(", ", table.columns().stream().map(Column::name).toList())
                  + ") VALUES "
                  + ProjectionJournal.valueTuples(page.size(), width));
      for (int row = 0; row < page.size(); row++) {
        bindRow(insert, row * width, header, page.get(row));
      }
      insert.execute();
    }
  }

  private static void bindRow(
      final Update insert, final int offset, final long header, final BufferedMembership row) {
    insert.bind(offset, header);
    for (int column = 0; column < row.values().size(); column++) {
      final Object value = row.values().get(column);
      final int position = offset + column + 1;
      switch (value) {
        case null -> insert.bindNull(position, row.table().columns().get(column).sqlType());
        case JsonText json -> json.bind(insert, position);
        default -> insert.bind(position, value);
      }
    }
  }

  enum Table {
    RELATIONSHIPS(
        "metadata_projection_relationship",
        List.of(
            new Column("fromId", Types.VARCHAR),
            new Column("toId", Types.VARCHAR),
            new Column("fromEntity", Types.VARCHAR),
            new Column("toEntity", Types.VARCHAR),
            new Column("relation", Types.INTEGER),
            new Column("relationType", Types.VARCHAR),
            new Column("relationshipId", Types.VARCHAR),
            new Column("relationshipTypeId", Types.VARCHAR),
            new Column("pipelineId", Types.VARCHAR))),
    TAG_USAGE(
        "metadata_projection_tag_usage",
        List.of(
            new Column("source", Types.INTEGER),
            new Column("tagFQN", Types.VARCHAR),
            new Column("tagFQNHash", Types.VARCHAR),
            new Column("targetFQNHash", Types.VARCHAR))),
    FIELD_RELATIONSHIPS(
        "metadata_projection_field_relationship",
        List.of(
            new Column("fromFQNHash", Types.VARCHAR),
            new Column("toFQNHash", Types.VARCHAR),
            new Column("fromFQN", Types.VARCHAR),
            new Column("toFQN", Types.VARCHAR),
            new Column("fromType", Types.VARCHAR),
            new Column("toType", Types.VARCHAR),
            new Column("relation", Types.INTEGER),
            new Column("jsonSchema", Types.VARCHAR),
            new Column("json", Types.OTHER)));

    private final String snapshotTable;
    private final List<Column> columns;

    Table(final String snapshotTable, final List<Column> columns) {
      this.snapshotTable = snapshotTable;
      this.columns = columns;
    }

    String snapshotTable() {
      return snapshotTable;
    }

    List<Column> columns() {
      return columns;
    }

    MutationFacts header() {
      return switch (this) {
        case RELATIONSHIPS -> new RelationshipMutation(1);
        case TAG_USAGE -> new TagUsageMutation(1);
        case FIELD_RELATIONSHIPS -> new FieldRelationshipMutation(1);
      };
    }
  }

  record Column(String name, int sqlType) {}

  /**
   * JSON text bound so each database stores it in its JSON column: PostgreSQL needs an untyped
   * parameter to convert into {@code jsonb}, and rejects a typed {@code varchar}, even when null.
   */
  record JsonText(String text, ConnectionType dialect) {
    void bind(final Update insert, final int position) {
      final int sqlType = dialect == ConnectionType.POSTGRES ? Types.OTHER : Types.VARCHAR;
      if (text == null) {
        insert.bindNull(position, sqlType);
      } else {
        insert.bindBySqlType(position, text, sqlType);
      }
    }
  }
}
