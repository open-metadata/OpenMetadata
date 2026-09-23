package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.CreationAuditMigration;

/**
 * Exercises the 2.1.0 creation-audit backfill against the real database in both dialects.
 *
 * <p>Rows created before 2.1.0 have no {@code createdAt}/{@code createdBy}. These tests recreate
 * that state by stripping the fields from the stored JSON, then assert the migration recovers the
 * values from version history and falls back to the entity's own timestamps when no history exists.
 */
// The backfill rewrites every table_entity row that is missing createdAt, so two of these tests
// running at once would each repopulate the row the other just stripped. They must not interleave.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class CreationAuditMigrationIT {

  private static final String TABLE_ENTITY = "table_entity";

  @Test
  void backfillRecoversCreationAuditFromOldestVersion(TestNamespace ns) throws Exception {
    Table table = createTableWithVersionHistory(ns, "creation-audit-history");
    long expectedCreatedAt = oldestVersionUpdatedAt(table.getId());
    String expectedCreatedBy = oldestVersionUpdatedBy(table.getId());

    stripCreationAudit(table.getId());
    assertNull(readCreatedAt(table.getId()), "precondition: createdAt removed from stored row");

    runBackfill();

    assertEquals(
        expectedCreatedAt,
        readCreatedAt(table.getId()),
        "createdAt should come from the oldest stored version");
    assertEquals(
        expectedCreatedBy,
        readCreatedBy(table.getId()),
        "createdBy should come from the oldest stored version");
  }

  @Test
  void backfillFallsBackToCurrentStateWhenVersionHistoryIsMissing(TestNamespace ns)
      throws Exception {
    Table table = createTableWithVersionHistory(ns, "creation-audit-nohistory");
    long currentUpdatedAt = readUpdatedAt(table.getId());
    String currentUpdatedBy = readUpdatedBy(table.getId());

    deleteVersionHistory(table.getId());
    stripCreationAudit(table.getId());

    runBackfill();

    assertEquals(
        currentUpdatedAt,
        readCreatedAt(table.getId()),
        "createdAt should fall back to the entity's own updatedAt");
    assertEquals(
        currentUpdatedBy,
        readCreatedBy(table.getId()),
        "createdBy should fall back to the entity's own updatedBy");
  }

  @Test
  void backfillIsIdempotentAndLeavesExistingValuesAlone(TestNamespace ns) throws Exception {
    Table table = createTableWithVersionHistory(ns, "creation-audit-idempotent");
    Long createdAtAfterCreate = readCreatedAt(table.getId());
    assertNotNull(createdAtAfterCreate, "a newly created table is already stamped");

    runBackfill();
    runBackfill();

    assertEquals(
        createdAtAfterCreate,
        readCreatedAt(table.getId()),
        "re-running the backfill must not move an already-populated createdAt");
  }

  private void runBackfill() {
    jdbi().useHandle(handle -> CreationAuditMigration.backfillCreationAudit(handle, dialect()));
  }

  /** Two updates leave versions 0.1 and 0.2 in entity_extension. */
  private Table createTableWithVersionHistory(TestNamespace ns, String prefix) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix(prefix + "-db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix(prefix + "-schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    table.setDescription("first revision");
    table = SdkClients.adminClient().tables().update(table.getId().toString(), table);
    table.setDescription("second revision");
    return SdkClients.adminClient().tables().update(table.getId().toString(), table);
  }

  private void stripCreationAudit(UUID id) {
    String sql =
        dialect() == ConnectionType.MYSQL
            ? "UPDATE table_entity SET json = JSON_REMOVE(json, '$.createdAt', '$.createdBy') WHERE id = :id"
            : "UPDATE table_entity SET json = (json - 'createdAt') - 'createdBy' WHERE id = :id";
    jdbi().useHandle(handle -> handle.createUpdate(sql).bind("id", id.toString()).execute());
  }

  private void deleteVersionHistory(UUID id) {
    jdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(
                        "DELETE FROM entity_extension WHERE id = :id AND extension LIKE 'table.version.%'")
                    .bind("id", id.toString())
                    .execute());
  }

  private long oldestVersionUpdatedAt(UUID id) {
    return Long.parseLong(oldestVersionField(id, "updatedAt"));
  }

  private String oldestVersionUpdatedBy(UUID id) {
    return oldestVersionField(id, "updatedBy");
  }

  private String oldestVersionField(UUID id, String field) {
    return jdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(oldestVersionQuery(field))
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .one());
  }

  private String oldestVersionQuery(String field) {
    String order =
        dialect() == ConnectionType.MYSQL
            ? "CAST(JSON_UNQUOTE(JSON_EXTRACT(json, '$.updatedAt')) AS UNSIGNED)"
            : "(json ->> 'updatedAt')::bigint";
    String projection =
        dialect() == ConnectionType.MYSQL
            ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$." + field + "'))"
            : "json ->> '" + field + "'";
    return "SELECT "
        + projection
        + " FROM entity_extension WHERE id = :id AND extension LIKE 'table.version.%'"
        + " ORDER BY "
        + order
        + " ASC LIMIT 1";
  }

  private Long readCreatedAt(UUID id) {
    String raw = readJsonField(id, "createdAt");
    return raw == null ? null : Long.valueOf(raw);
  }

  private String readCreatedBy(UUID id) {
    return readJsonField(id, "createdBy");
  }

  private long readUpdatedAt(UUID id) {
    return Long.parseLong(readJsonField(id, "updatedAt"));
  }

  private String readUpdatedBy(UUID id) {
    return readJsonField(id, "updatedBy");
  }

  /** Every field is read as text so one accessor works for both dialects and for absent keys. */
  private String readJsonField(UUID id, String field) {
    String projection =
        dialect() == ConnectionType.MYSQL
            ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$." + field + "'))"
            : "json ->> '" + field + "'";
    String sql = "SELECT " + projection + " FROM " + TABLE_ENTITY + " WHERE id = :id";
    return jdbi()
        .withHandle(
            (Handle handle) ->
                handle
                    .createQuery(sql)
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .findOne()
                    .orElse(null));
  }

  private Jdbi jdbi() {
    return TestSuiteBootstrap.getJdbi();
  }

  private ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
