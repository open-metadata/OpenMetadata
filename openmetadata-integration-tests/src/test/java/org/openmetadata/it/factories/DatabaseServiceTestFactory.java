package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * Factory for creating DatabaseService entities in integration tests.
 *
 * <p>Uses the static fluent API from {@link DatabaseServices}. Ensure
 * fluent APIs are initialized before using these methods.
 */
public class DatabaseServiceTestFactory {

  /**
   * Create a Postgres database service with default settings.
   */
  public static DatabaseService createPostgres(TestNamespace ns) {
    PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("postgresService_" + uniqueId);

    return DatabaseServices.builder()
        .name(name)
        .connection(conn)
        .description("Test Postgres service")
        .create();
  }

  /**
   * Create a Snowflake database service with default settings.
   */
  public static DatabaseService createSnowflake(TestNamespace ns) {
    SnowflakeConnection conn =
        DatabaseServices.snowflakeConnection()
            .account("test-account")
            .username("test")
            .warehouse("test-warehouse")
            .build();

    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("snowflakeService_" + uniqueId);

    return DatabaseServices.builder()
        .name(name)
        .connection(conn)
        .description("Test Snowflake service")
        .create();
  }

  /**
   * Create a database service with specified type.
   */
  public static DatabaseService create(TestNamespace ns, String serviceType) {
    if ("Postgres".equalsIgnoreCase(serviceType)) {
      return createPostgres(ns);
    } else if ("Snowflake".equalsIgnoreCase(serviceType)) {
      return createSnowflake(ns);
    } else {
      return createPostgres(ns);
    }
  }
}
