package org.openmetadata.service.migration.utils;

import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;

/**
 * Stops a MySQL migration before it changes anything when the database does not use the collation
 * the schema is built for. Newer tables pin {@value #REQUIRED_COLLATION}, while the core tables
 * take the database default. Migrations and queries compare ids across both, and MySQL refuses to
 * compare two different collations, so any other default fails part way through an upgrade.
 */
public final class MySqlCollationCheck {
  public static final String REQUIRED_COLLATION = "utf8mb4_0900_ai_ci";

  private static final String COLLATIONS_QUERY =
      "SELECT 'the database default' AS target, DEFAULT_COLLATION_NAME AS collation"
          + " FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()"
          + " UNION ALL"
          + " SELECT CONCAT('table ', TABLE_NAME), TABLE_COLLATION FROM information_schema.TABLES"
          + " WHERE TABLE_SCHEMA = DATABASE()"
          + " AND TABLE_NAME IN ('entity_relationship', 'entity_extension')"
          + " ORDER BY target";

  private static final String MESSAGE =
      "This MySQL database uses a collation OpenMetadata does not support: %s. OpenMetadata needs"
          + " %s, the MySQL 8 default, because its migrations and queries compare columns across"
          + " tables and MySQL refuses to compare two different collations. Nothing has been"
          + " changed. Back up the database, run ALTER DATABASE `%s` CHARACTER SET utf8mb4 COLLATE"
          + " %s, change the utf8mb4 columns of the tables still on the old collation to %s, then"
          + " run the migration again.";

  private MySqlCollationCheck() {}

  public static void verify(Jdbi jdbi) {
    jdbi.useHandle(MySqlCollationCheck::verify);
  }

  static void verify(Handle handle) {
    List<String> mismatches = findMismatches(handle);
    if (!mismatches.isEmpty()) {
      String database = handle.createQuery("SELECT DATABASE()").mapTo(String.class).one();
      throw new IllegalStateException(
          String.format(
              MESSAGE,
              String.join(", ", mismatches),
              REQUIRED_COLLATION,
              database,
              REQUIRED_COLLATION,
              REQUIRED_COLLATION));
    }
  }

  static List<String> findMismatches(Handle handle) {
    return handle
        .createQuery(COLLATIONS_QUERY)
        .map((row, context) -> new Target(row.getString("target"), row.getString("collation")))
        .stream()
        .filter(target -> !REQUIRED_COLLATION.equals(target.collation()))
        .map(target -> target.name() + " uses " + target.collation())
        .toList();
  }

  private record Target(String name, String collation) {}
}
