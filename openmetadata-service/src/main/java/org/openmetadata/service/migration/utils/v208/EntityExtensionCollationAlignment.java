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

package org.openmetadata.service.migration.utils.v208;

import java.util.List;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

/**
 * Puts {@code entity_extension.extension} back on its table's default character set and collation
 * on MySQL. Until #37167, the 2.0.3 migration switched the column to {@code ascii_bin}, so databases
 * upgraded through 2.0.3 to 2.0.7 differ from the rest of the table and from databases that never
 * ran that statement. The target is the table's own default, per
 * ADR:2026-11-06-entity-extension-uses-its-tables-collation: OpenMetadata never set a collation, so
 * each table carries the server default of the day it was created.
 *
 * <p>MySQL copies the whole table to change a character set and blocks writes to it until the copy
 * ends, so this runs only when the column differs from its table. It first checks that no two keys
 * of one entity become equal under the table's collation, such as the values of two custom
 * properties named {@code Foo} and {@code foo}. If any would, it stops before copying and names
 * them, instead of failing on a duplicate key hours into the copy.
 *
 * <p>2.1.0 runs it again, because a database that recorded 2.0.8 before this step existed reruns
 * 2.0.8 for its SQL only.
 */
@Slf4j
public final class EntityExtensionCollationAlignment {
  public static final String STEP_NAME = "entityExtensionCollationAlignment";

  private static final int REPORTED_COLLISIONS = 20;
  private static final Pattern MYSQL_NAME = Pattern.compile("[a-z0-9_]+");
  private static final String COLUMN_STATE_QUERY =
      """
      SELECT c.COLLATION_NAME, t.TABLE_COLLATION, tc.CHARACTER_SET_NAME,
             ROUND((t.DATA_LENGTH + t.INDEX_LENGTH) / 1024 / 1024 / 1024, 1)
      FROM information_schema.COLUMNS c
      JOIN information_schema.TABLES t
        ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      JOIN information_schema.COLLATIONS tc ON tc.COLLATION_NAME = t.TABLE_COLLATION
      WHERE c.TABLE_SCHEMA = DATABASE()
        AND c.TABLE_NAME = 'entity_extension'
        AND c.COLUMN_NAME = 'extension'
      """;
  private static final String COLLIDING_KEYS_QUERY =
      """
      SELECT CONCAT(id, ': ', GROUP_CONCAT(extension ORDER BY extension SEPARATOR ', '))
      FROM entity_extension
      GROUP BY id, CONVERT(extension USING %1$s) COLLATE %2$s
      HAVING COUNT(*) > 1
      ORDER BY id
      LIMIT %3$d
      """;
  private static final String ALIGN_STATEMENT =
      "ALTER TABLE entity_extension MODIFY COLUMN extension VARCHAR(512)"
          + " CHARACTER SET %s COLLATE %s NOT NULL";

  record ColumnState(
      String columnCollation, String tableCollation, String tableCharset, double sizeGb) {
    boolean isAligned() {
      return tableCollation.equals(columnCollation);
    }
  }

  private EntityExtensionCollationAlignment() {}

  /** Returns whether the column had to be aligned. */
  public static boolean alignOnMySql(final Handle handle) {
    final ColumnState state = readColumnState(handle);
    final boolean needsAlignment = !state.isAligned();
    if (needsAlignment) {
      requireNoCollidingKeys(handle, state);
      align(handle, state);
    }
    return needsAlignment;
  }

  static ColumnState readColumnState(final Handle handle) {
    return handle
        .createQuery(COLUMN_STATE_QUERY)
        .map(
            (rs, ctx) ->
                new ColumnState(rs.getString(1), rs.getString(2), rs.getString(3), rs.getDouble(4)))
        .one();
  }

  private static void requireNoCollidingKeys(final Handle handle, final ColumnState state) {
    LOG.info(
        "Checking entity_extension for keys that become equal under {} before aligning it",
        state.tableCollation());
    final List<String> collisions = findCollidingKeys(handle, state);
    if (!collisions.isEmpty()) {
      throw new IllegalStateException(collisionMessage(state, collisions));
    }
  }

  static List<String> findCollidingKeys(final Handle handle, final ColumnState state) {
    final String query =
        COLLIDING_KEYS_QUERY.formatted(
            mysqlName(state.tableCharset()),
            mysqlName(state.tableCollation()),
            REPORTED_COLLISIONS);
    return handle.createQuery(query).mapTo(String.class).list();
  }

  private static String collisionMessage(final ColumnState state, final List<String> collisions) {
    return String.format(
        "Cannot align entity_extension.extension to %s: some keys of the same entity differ only"
            + " in letter case and would become duplicates. They usually come from two custom"
            + " properties whose names differ only in case. Delete or rename one property of each"
            + " pair, then run the migration again. Conflicting keys (entity id: keys, up to %d"
            + " shown): %s",
        state.tableCollation(), REPORTED_COLLISIONS, String.join("; ", collisions));
  }

  private static void align(final Handle handle, final ColumnState state) {
    LOG.info(
        "Aligning entity_extension.extension from {} to {}. MySQL copies the table ({} GB) and"
            + " blocks writes to it until the copy ends, which can take hours on a large table.",
        state.columnCollation(),
        state.tableCollation(),
        state.sizeGb());
    handle.execute(alignStatement(state));
  }

  static String alignStatement(final ColumnState state) {
    return ALIGN_STATEMENT.formatted(
        mysqlName(state.tableCharset()), mysqlName(state.tableCollation()));
  }

  private static String mysqlName(final String name) {
    if (!MYSQL_NAME.matcher(name).matches()) {
      throw new IllegalStateException("Unexpected MySQL character set or collation: " + name);
    }
    return name;
  }
}
