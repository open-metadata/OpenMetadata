package org.openmetadata.sdk.fluent;

import java.util.UUID;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.*;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.DatabaseServiceBuilder;
import org.openmetadata.sdk.fluent.request.DeleteRequest;

/**
 * Fluent API for DatabaseService operations following Stripe SDK patterns.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.DatabaseServices.*;
 *
 * // Create a MySQL service
 * DatabaseService service = builder()
 *     .name("mysql-prod")
 *     .serviceType("Mysql")
 *     .connection(mysqlConnection()
 *         .hostPort("localhost:3306")
 *         .username("root")
 *         .password(getSecret("mysql-password")))
 *     .create();
 *
 * // Retrieve service
 * DatabaseService service = retrieve(serviceId);
 * </pre>
 */
public final class DatabaseServices {
  private static OpenMetadataClient defaultClient;

  private DatabaseServices() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call DatabaseServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  /**
   * Create a new DatabaseServiceBuilder for fluent service creation.
   */
  public static DatabaseServiceBuilder builder() {
    return new DatabaseServiceBuilder(getClient());
  }

  /**
   * Convenience builder already named.
   */
  public static DatabaseServiceBuilder databaseService() {
    return builder();
  }

  /**
   * Create a database service directly from a CreateDatabaseService request.
   */
  public static DatabaseService create(CreateDatabaseService request) {
    // Pass Create request directly to the service
    return getClient().databaseServices().create(request);
  }

  // ==================== Retrieval ====================

  /**
   * Retrieve a database service by ID.
   */
  public static DatabaseService retrieve(String serviceId) {
    return getClient().databaseServices().get(serviceId);
  }

  /**
   * Retrieve a database service by UUID.
   */
  public static DatabaseService retrieve(UUID serviceId) {
    return retrieve(serviceId.toString());
  }

  /**
   * Retrieve a database service by name.
   */
  public static DatabaseService retrieveByName(String name) {
    return getClient().databaseServices().getByName(name);
  }

  // ==================== Updates ====================

  /**
   * Update a database service.
   */
  public static DatabaseService update(String serviceId, DatabaseService service) {
    return getClient().databaseServices().update(serviceId, service);
  }

  /**
   * Update a database service using its ID.
   */
  public static DatabaseService update(DatabaseService service) {
    if (service.getId() == null) {
      throw new IllegalArgumentException("DatabaseService must have an ID for update");
    }
    return update(service.getId().toString(), service);
  }

  // ==================== Deletion ====================

  /**
   * Create a fluent delete request.
   *
   * Usage:
   * <pre>
   * // Soft delete
   * DatabaseServices.delete(id).execute();
   *
   * // Hard delete
   * DatabaseServices.delete(id).hardDelete().execute();
   *
   * // Recursive delete
   * DatabaseServices.delete(id).recursive().execute();
   *
   * // Combined
   * DatabaseServices.delete(id).recursive().hardDelete().execute();
   * </pre>
   *
   * @param id The ID to delete
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<DatabaseService> delete(String id) {
    return new DeleteRequest<>(id, params -> getClient().databaseServices().delete(id, params));
  }

  /**
   * Delete by UUID.
   *
   * @param id The UUID
   * @return A DeleteRequest for fluent configuration
   */
  public static DeleteRequest<DatabaseService> delete(UUID id) {
    return delete(id.toString());
  }

  // ==================== Connection Builders ====================

  /**
   * Create a MySQL connection configuration.
   */
  public static MysqlConnectionBuilder mysqlConnection() {
    return new MysqlConnectionBuilder();
  }

  /**
   * Create a PostgreSQL connection configuration.
   */
  public static PostgresConnectionBuilder postgresConnection() {
    return new PostgresConnectionBuilder();
  }

  /**
   * Create a Snowflake connection configuration.
   */
  public static SnowflakeConnectionBuilder snowflakeConnection() {
    return new SnowflakeConnectionBuilder();
  }

  /**
   * Create a BigQuery connection configuration.
   */
  public static BigQueryConnectionBuilder bigQueryConnection() {
    return new BigQueryConnectionBuilder();
  }

  /**
   * Create a Redshift connection configuration.
   */
  public static RedshiftConnectionBuilder redshiftConnection() {
    return new RedshiftConnectionBuilder();
  }

  // ==================== Connection Builder Classes ====================

  public static class MysqlConnectionBuilder {
    private final MysqlConnection connection;

    public MysqlConnectionBuilder() {
      this.connection = new MysqlConnection();
    }

    public MysqlConnectionBuilder hostPort(String hostPort) {
      connection.setHostPort(hostPort);
      return this;
    }

    public MysqlConnectionBuilder username(String username) {
      connection.setUsername(username);
      return this;
    }

    public MysqlConnectionBuilder password(String password) {
      return this;
    }

    public MysqlConnectionBuilder database(String database) {
      connection.setDatabaseName(database);
      return this;
    }

    public MysqlConnectionBuilder databaseSchema(String schema) {
      connection.setDatabaseSchema(schema);
      return this;
    }

    public MysqlConnection build() {
      return connection;
    }
  }

  public static class PostgresConnectionBuilder {
    private final PostgresConnection connection;

    public PostgresConnectionBuilder() {
      this.connection = new PostgresConnection();
    }

    public PostgresConnectionBuilder hostPort(String hostPort) {
      connection.setHostPort(hostPort);
      return this;
    }

    public PostgresConnectionBuilder username(String username) {
      connection.setUsername(username);
      return this;
    }

    public PostgresConnectionBuilder password(String password) {
      return this;
    }

    public PostgresConnectionBuilder database(String database) {
      connection.setDatabase(database);
      return this;
    }

    public PostgresConnection build() {
      return connection;
    }
  }

  public static class SnowflakeConnectionBuilder {
    private final SnowflakeConnection connection;

    public SnowflakeConnectionBuilder() {
      this.connection = new SnowflakeConnection();
    }

    public SnowflakeConnectionBuilder username(String username) {
      connection.setUsername(username);
      return this;
    }

    public SnowflakeConnectionBuilder password(String password) {
      return this;
    }

    public SnowflakeConnectionBuilder account(String account) {
      connection.setAccount(account);
      return this;
    }

    public SnowflakeConnectionBuilder warehouse(String warehouse) {
      connection.setWarehouse(warehouse);
      return this;
    }

    public SnowflakeConnectionBuilder database(String database) {
      connection.setDatabase(database);
      return this;
    }

    public SnowflakeConnectionBuilder role(String role) {
      connection.setRole(role);
      return this;
    }

    public SnowflakeConnection build() {
      return connection;
    }
  }

  public static class BigQueryConnectionBuilder {
    private final BigQueryConnection connection;

    public BigQueryConnectionBuilder() {
      this.connection = new BigQueryConnection();
    }

    public BigQueryConnectionBuilder projectId(String projectId) {
      // Note: BigQuery uses different field names
      // This would need to map to the correct field
      return this;
    }

    public BigQueryConnectionBuilder credentials(String credentials) {
      // JSON credentials
      return this;
    }

    public BigQueryConnection build() {
      return connection;
    }
  }

  public static class RedshiftConnectionBuilder {
    private final RedshiftConnection connection;

    public RedshiftConnectionBuilder() {
      this.connection = new RedshiftConnection();
    }

    public RedshiftConnectionBuilder hostPort(String hostPort) {
      connection.setHostPort(hostPort);
      return this;
    }

    public RedshiftConnectionBuilder username(String username) {
      connection.setUsername(username);
      return this;
    }

    public RedshiftConnectionBuilder password(String password) {
      return this;
    }

    public RedshiftConnectionBuilder database(String database) {
      connection.setDatabase(database);
      return this;
    }

    public RedshiftConnection build() {
      return connection;
    }
  }
}
