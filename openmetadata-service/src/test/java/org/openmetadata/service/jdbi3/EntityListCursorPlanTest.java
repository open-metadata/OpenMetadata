package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.repositoryRoot;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.TemplateEngine;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * PostgreSQL derives no index bound from the expanded cursor predicate {@code name > ? OR (name = ?
 * AND id > ?)}, so a page walks the name index from the first row. Each POSTGRES list query that
 * takes a row-value cursor must start its index scan at the cursor: the cursor name appears in the
 * index condition, whichever name index the planner picks
 * (ADR:2026-11-03-entity-list-cursors-are-row-values-on-postgres-only).
 */
class EntityListCursorPlanTest {
  private static final String TABLE = "table_entity";
  private static final String NOT_DELETED = "WHERE table_entity.deleted = FALSE";
  private static final String CURSOR_NAME = "tbl_2500";
  private static final String CURSOR_ID = "80000000-0000-0000-0000-000000000000";
  private static final int LIMIT = 101;
  private static final Pattern TABLE_ENTITY_DDL =
      Pattern.compile("(?s).*(CREATE TABLE IF NOT EXISTS|ALTER TABLE|ON) table_entity[\\s(].*");
  private static final Pattern CURSOR_INDEX_COND =
      Pattern.compile("index cond: [^\\n]*" + Pattern.quote("'" + CURSOR_NAME + "'"));

  @Test
  void everyPostgresListQueryStartsTheIndexScanAtTheCursor() {
    withDatabase(
        ConnectionType.POSTGRES,
        handle -> {
          createTableEntity(handle);
          seedTables(handle);
          final Map<String, List<String>> plans = cursorQueryPlans(explaining(handle));
          assertAll(
              plans.entrySet().stream()
                  .map(plan -> () -> assertStartsAtCursor(plan.getKey(), plan.getValue())));
        });
  }

  private static Map<String, List<String>> cursorQueryPlans(final Handle handle) {
    final var dao = handle.attach(CollectionDAO.class).tableDAO();
    final Map<String, ?> noParams = Map.of();
    return Map.of(
        "shared listAfter",
        dao.listAfter(TABLE, noParams, NOT_DELETED, LIMIT, CURSOR_NAME, CURSOR_ID),
        "shared listBefore",
        dao.listBefore(TABLE, noParams, NOT_DELETED, LIMIT, CURSOR_NAME, CURSOR_ID),
        "per-database listAfter",
        dao.listAfter(TABLE, noParams, NOT_DELETED, NOT_DELETED, LIMIT, CURSOR_NAME, CURSOR_ID),
        "per-database listBefore",
        dao.listBefore(TABLE, noParams, NOT_DELETED, NOT_DELETED, LIMIT, CURSOR_NAME, CURSOR_ID));
  }

  private static void assertStartsAtCursor(final String query, final List<String> planRows) {
    final String plan = String.join("\n", planRows).toLowerCase(Locale.ROOT);
    assertTrue(
        CURSOR_INDEX_COND.matcher(plan).find(),
        query + " must start the index scan at the cursor:\n" + plan);
  }

  /** Prefixes every statement with EXPLAIN, so the DAO methods return the plans of their own SQL. */
  private static Handle explaining(final Handle handle) {
    final SqlStatements statements = handle.getConfig(SqlStatements.class);
    final TemplateEngine rendering = statements.getTemplateEngine();
    statements.setTemplateEngine(
        (template, context) -> "EXPLAIN " + rendering.render(template, context));
    return handle;
  }

  private static void createTableEntity(final Handle handle) {
    final Path migrations = repositoryRoot().resolve("bootstrap/sql/migrations");
    for (String file :
        List.of(
            "flyway/org.postgresql.Driver/v001__create_db_connection_info.sql",
            "native/1.1.0/postgres/schemaChanges.sql",
            "native/1.2.0/postgres/schemaChanges.sql",
            "native/1.8.2/postgres/schemaChanges.sql")) {
      MigrationFile.parseSQLFile(migrations.resolve(file).toFile(), ConnectionType.POSTGRES)
          .stream()
          .filter(TABLE_ENTITY_DDL.asMatchPredicate())
          .forEach(handle::execute);
    }
  }

  /** 20,000 tables whose names repeat four times each, about 3 % of them soft-deleted. */
  private static void seedTables(final Handle handle) {
    handle.execute(
        """
        INSERT INTO table_entity (json, fqnHash)
        SELECT jsonb_build_object(
                 'id', gen_random_uuid()::text,
                 'name', 'tbl_' || (n % 5000),
                 'updatedAt', 0,
                 'updatedBy', 'admin',
                 'deleted', n % 33 = 0),
               md5(n::text)
        FROM generate_series(1, 20000) AS n
        """);
    handle.execute("ANALYZE table_entity");
  }
}
