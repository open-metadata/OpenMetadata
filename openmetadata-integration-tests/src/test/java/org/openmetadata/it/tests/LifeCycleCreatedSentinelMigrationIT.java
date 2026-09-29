package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.LifeCycleCreatedSentinelMigration;

/**
 * Exercises the 2.1.0 repair that removes the placeholder {@code lifeCycle.created} earlier
 * ingestion runs stored when a source reported no creation time, against the real database.
 */
// The repair rewrites every table_entity row with a negative lifeCycle.created, so these tests must
// not interleave with each other.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class LifeCycleCreatedSentinelMigrationIT {

  // What LifeCycleQueryMixin stored for datetime.min: epoch milliseconds for 0001-01-01T00:00Z.
  private static final long PLACEHOLDER_CREATED = -62135596800000L;
  private static final long REAL_CREATED = 1609459200000L;

  @Test
  void repairRemovesPlaceholderCreatedTime(TestNamespace ns) throws Exception {
    Table table = createTable(ns, "lifecycle-placeholder");
    storeCreatedTimestamp(table.getId(), PLACEHOLDER_CREATED);

    runRepair();

    assertNull(
        readCreatedTimestamp(table.getId()), "the placeholder created time should be removed");
  }

  @Test
  void repairKeepsRealCreatedTimeAndIsIdempotent(TestNamespace ns) throws Exception {
    Table table = createTable(ns, "lifecycle-real");
    storeCreatedTimestamp(table.getId(), REAL_CREATED);

    runRepair();
    runRepair();

    assertEquals(
        REAL_CREATED,
        readCreatedTimestamp(table.getId()),
        "a real created time must survive the repair, however often it runs");
  }

  private void runRepair() {
    jdbi()
        .useHandle(
            handle -> LifeCycleCreatedSentinelMigration.removeCreatedSentinel(handle, dialect()));
  }

  private Table createTable(TestNamespace ns, String prefix) throws Exception {
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
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  /** Writes the life cycle straight into the stored row, the way the ingestion sink left it. */
  private void storeCreatedTimestamp(UUID id, long timestamp) {
    String sql =
        dialect() == ConnectionType.MYSQL
            ? "UPDATE table_entity SET json = JSON_SET(json, '$.lifeCycle',"
                + " JSON_OBJECT('created', JSON_OBJECT('timestamp', :timestamp))) WHERE id = :id"
            : "UPDATE table_entity SET json = jsonb_set(json, '{lifeCycle}',"
                + " jsonb_build_object('created', jsonb_build_object('timestamp',"
                + " CAST(:timestamp AS bigint)))) WHERE id = :id";
    jdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate(sql)
                    .bind("timestamp", timestamp)
                    .bind("id", id.toString())
                    .execute());
  }

  private Long readCreatedTimestamp(UUID id) {
    String projection =
        dialect() == ConnectionType.MYSQL
            ? "JSON_UNQUOTE(JSON_EXTRACT(json, '$.lifeCycle.created.timestamp'))"
            : "json -> 'lifeCycle' -> 'created' ->> 'timestamp'";
    String raw =
        jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT " + projection + " FROM table_entity WHERE id = :id")
                        .bind("id", id.toString())
                        .mapTo(String.class)
                        .findOne()
                        .orElse(null));
    return raw == null ? null : Long.valueOf(raw);
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
