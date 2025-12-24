package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;

/**
 * Factory for creating DatabaseSchema entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link DatabaseSchemas}. Ensure
 * fluent APIs are initialized before using these methods.
 */
public class DatabaseSchemaTestFactory {

  /**
   * Create a schema with database FQN using fluent API.
   */
  public static DatabaseSchema create(TestNamespace ns, String databaseFqn) {
    return DatabaseSchemas.create().name(ns.prefix("schema")).in(databaseFqn).execute();
  }

  /**
   * Create a schema with its parent database using fluent API.
   */
  public static DatabaseSchema createSimple(TestNamespace ns, DatabaseService service) {
    // Create database first using fluent API
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();

    // Then create schema using fluent API
    return DatabaseSchemas.create()
        .name(ns.prefix("schema"))
        .in(database.getFullyQualifiedName())
        .execute();
  }

  /**
   * Create a schema with a newly created database service.
   */
  public static DatabaseSchema createSimple(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return createSimple(ns, service);
  }

  /**
   * Create a schema with a custom name using fluent API.
   * Useful for tests that need short names to avoid FQN length limits.
   */
  public static DatabaseSchema createSimpleWithName(
      String schemaName, TestNamespace ns, DatabaseService service) {
    // Create database first using short name
    String shortDbName = "db" + schemaName.substring(2); // Use same short ID
    Database database =
        Databases.create().name(shortDbName).in(service.getFullyQualifiedName()).execute();

    // Then create schema using the specified name
    return DatabaseSchemas.create().name(schemaName).in(database.getFullyQualifiedName()).execute();
  }
}
