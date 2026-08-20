package org.openmetadata.it.factories;

import java.util.List;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.service.Entity;

/**
 * Builds a service → database → schema → table chain whose total FQN length is
 * bounded — every level uses {@link TestNamespace#uniqueShortId()} (~16 chars)
 * instead of {@link TestNamespace#prefix(String)} (~80–120 chars).
 *
 * <p>Use this when a test creates entities the system will downstream-name
 * (e.g., implicit executable test suites named {@code <table.fqn>.testSuite})
 * — those derived names hit MySQL column length limits when each level
 * carries the full namespace prefix.
 */
public final class ShortStackFactory {

  private ShortStackFactory() {}

  /**
   * Build the full chain and return the table. Each level shares the same
   * {@code shortPrefix} so the components are still globally unique within the
   * test run, just much shorter.
   */
  public static Table table(final TestNamespace ns) {
    final String tag = ns.uniqueShortId();
    final DatabaseService service = ns.trackRoot(Entity.DATABASE_SERVICE, service(tag));
    final Database database = database(service, tag);
    final DatabaseSchema schema = schema(database, tag);
    return Tables.create()
        .name("tbl_" + tag)
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(defaultColumns())
        .execute();
  }

  private static DatabaseService service(final String tag) {
    final PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();
    return DatabaseServices.builder()
        .name("svc_" + tag)
        .connection(conn)
        .description("short stack")
        .create();
  }

  private static Database database(final DatabaseService service, final String tag) {
    return Databases.create().name("db_" + tag).in(service.getFullyQualifiedName()).execute();
  }

  private static DatabaseSchema schema(final Database database, final String tag) {
    return DatabaseSchemas.create()
        .name("sch_" + tag)
        .in(database.getFullyQualifiedName())
        .execute();
  }

  private static List<Column> defaultColumns() {
    return List.of(
        new Column().withName("id").withDataType(ColumnDataType.STRING),
        new Column().withName("v").withDataType(ColumnDataType.STRING));
  }
}
