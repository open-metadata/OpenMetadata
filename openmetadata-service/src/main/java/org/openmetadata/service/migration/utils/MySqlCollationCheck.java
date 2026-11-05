package org.openmetadata.service.migration.utils;

import java.util.List;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;

/**
 * Stops a MySQL command before it changes anything when the database uses a collation that clashes
 * with the schema. Newer tables pin {@value #REQUIRED_COLLATION}, while the core tables take the
 * database default, and migrations and queries compare the core id columns with ids in the newer
 * tables. MySQL refuses to compare two different non-binary collations of the same character set,
 * so only a utf8mb4 collation other than {@value #REQUIRED_COLLATION} or a {@code _bin} one fails:
 * MySQL converts any other character set to utf8mb4, and a {@code _bin} collation wins the
 * comparison.
 */
public final class MySqlCollationCheck {
  public static final String REQUIRED_COLLATION = "utf8mb4_0900_ai_ci";
  private static final String CLASHING_CHARACTER_SET = "utf8mb4";
  private static final String BINARY_COLLATION_SUFFIX = "_bin";

  private static final String DATABASE_DEFAULT_QUERY =
      "SELECT 'the database default' AS target, DEFAULT_CHARACTER_SET_NAME AS characterSet,"
          + " DEFAULT_COLLATION_NAME AS collation"
          + " FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()";

  // Columns, not TABLE_COLLATION: ALTER TABLE ... COLLATE without CONVERT TO changes only the
  // table default and leaves the columns on the old collation.
  private static final String CORE_ID_COLUMNS_QUERY =
      "SELECT CONCAT('column ', TABLE_NAME, '.', COLUMN_NAME) AS target,"
          + " CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation"
          + " FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()"
          + " AND ((TABLE_NAME = 'entity_relationship' AND COLUMN_NAME IN ('fromId', 'toId'))"
          + " OR (TABLE_NAME = 'entity_extension' AND COLUMN_NAME = 'id'))"
          + " ORDER BY target";

  private static final String MESSAGE =
      "This MySQL database uses a utf8mb4 collation that clashes with the %s tables of"
          + " OpenMetadata: %s. MySQL refuses to compare two different non-binary utf8mb4"
          + " collations, so the migrations and queries that compare ids across these tables would"
          + " fail. Nothing has been changed. Back up the database, then move each item listed to"
          + " %s: for the database default, run ALTER DATABASE `%s` CHARACTER SET utf8mb4 COLLATE"
          + " %s; for a column, change its collation with ALTER TABLE ... MODIFY, keeping its type"
          + " and NOT NULL. Then run the command again.";

  private MySqlCollationCheck() {}

  /** Checks the database default and the core id columns, before a migration. */
  public static void verify(Jdbi jdbi) {
    jdbi.useHandle(handle -> stopOnClashes(handle, findClashes(handle)));
  }

  /** Checks only the database default, before drop-create recreates every table from it. */
  public static void verifyDatabaseDefault(Jdbi jdbi) {
    jdbi.useHandle(handle -> stopOnClashes(handle, findDatabaseDefaultClashes(handle)));
  }

  static List<String> findClashes(Handle handle) {
    return Stream.concat(
            findDatabaseDefaultClashes(handle).stream(),
            findClashes(handle, CORE_ID_COLUMNS_QUERY).stream())
        .toList();
  }

  static List<String> findDatabaseDefaultClashes(Handle handle) {
    return findClashes(handle, DATABASE_DEFAULT_QUERY);
  }

  private static List<String> findClashes(Handle handle, String query) {
    return handle
        .createQuery(query)
        .map(
            (row, context) ->
                new Target(
                    row.getString("target"),
                    row.getString("characterSet"),
                    row.getString("collation")))
        .stream()
        .filter(Target::clashes)
        .map(target -> target.name() + " uses " + target.collation())
        .toList();
  }

  private static void stopOnClashes(Handle handle, List<String> clashes) {
    if (!clashes.isEmpty()) {
      String database = handle.createQuery("SELECT DATABASE()").mapTo(String.class).one();
      throw new IllegalStateException(
          String.format(
              MESSAGE,
              REQUIRED_COLLATION,
              String.join(", ", clashes),
              REQUIRED_COLLATION,
              database,
              REQUIRED_COLLATION));
    }
  }

  private record Target(String name, String characterSet, String collation) {
    boolean clashes() {
      return CLASHING_CHARACTER_SET.equals(characterSet)
          && !REQUIRED_COLLATION.equals(collation)
          && !collation.endsWith(BINARY_COLLATION_SUFFIX);
    }
  }
}
