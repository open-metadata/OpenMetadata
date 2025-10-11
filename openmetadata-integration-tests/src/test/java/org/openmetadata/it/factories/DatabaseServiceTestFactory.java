package org.openmetadata.it.factories;

import java.util.UUID;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseServices;

/**
 * Factory for creating DatabaseService entities in integration tests.
 *
 * Migrated from: org.openmetadata.service.resources.EntityResourceTest setup methods
 * Provides namespace-isolated entity creation with consistent patterns.
 */
public class DatabaseServiceTestFactory {

  /**
   * Create a Postgres database service with default settings.
   * Each call creates a unique service to avoid conflicts in parallel test execution.
   */
  public static DatabaseService createPostgres(OpenMetadataClient client, TestNamespace ns) {
    PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();

    // Add UUID suffix to ensure each service is unique, even if called multiple times in same test
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
   * Each call creates a unique service to avoid conflicts in parallel test execution.
   */
  public static DatabaseService createSnowflake(OpenMetadataClient client, TestNamespace ns) {
    SnowflakeConnection conn =
        DatabaseServices.snowflakeConnection()
            .account("test-account")
            .username("test")
            .warehouse("test-warehouse")
            .build();

    // Add UUID suffix to ensure each service is unique, even if called multiple times in same test
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String name = ns.prefix("snowflakeService_" + uniqueId);

    return DatabaseServices.builder()
        .name(name)
        .connection(conn)
        .description("Test Snowflake service")
        .create();
  }

  /**
   * Get database service by ID.
   */
  public static DatabaseService getById(OpenMetadataClient client, String id) {
    return client.databaseServices().get(id);
  }

  /**
   * Create a database service with specified type (backward compatibility).
   *
   * @param client OpenMetadataClient
   * @param ns Test namespace
   * @param serviceType Type of service ("Postgres", "Snowflake", etc.)
   * @param connectionJson Ignored - connection is built internally
   * @return Created database service
   */
  public static DatabaseService create(
      OpenMetadataClient client, TestNamespace ns, String serviceType, String connectionJson) {

    // Route to specific factory methods based on type
    if ("Postgres".equalsIgnoreCase(serviceType)) {
      return createPostgres(client, ns);
    } else if ("Snowflake".equalsIgnoreCase(serviceType)) {
      return createSnowflake(client, ns);
    } else {
      // Default to Postgres
      return createPostgres(client, ns);
    }
  }

  /**
   * Update database service description.
   */
  public static void updateDescription(OpenMetadataClient client, String id, String description) {
    DatabaseService svc = client.databaseServices().get(id);
    svc.setDescription(description);
    client.databaseServices().update(id, svc);
  }
}
