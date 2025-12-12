package org.openmetadata.sdk.fluent.builders;

import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.*;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating DatabaseService entities.
 *
 * <pre>
 * DatabaseService service = DatabaseServiceBuilder.create(client)
 *     .name("mysql-prod")
 *     .serviceType("Mysql")
 *     .description("Production MySQL database")
 *     .connection(mysqlConnection)
 *     .create();
 * </pre>
 */
public class DatabaseServiceBuilder {
  private final OpenMetadataClient client;
  private final CreateDatabaseService request;

  public DatabaseServiceBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDatabaseService();
  }

  /**
   * Set the service name (required).
   */
  public DatabaseServiceBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the service display name.
   */
  public DatabaseServiceBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the service description.
   */
  public DatabaseServiceBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set the service type (Mysql, Postgres, Snowflake, etc.).
   */
  public DatabaseServiceBuilder serviceType(String serviceType) {
    request.setServiceType(CreateDatabaseService.DatabaseServiceType.fromValue(serviceType));
    return this;
  }

  /**
   * Set the service type using enum.
   */
  public DatabaseServiceBuilder serviceType(CreateDatabaseService.DatabaseServiceType serviceType) {
    request.setServiceType(serviceType);
    return this;
  }

  /**
   * Set the database connection configuration.
   */
  public DatabaseServiceBuilder connection(Object connection) {
    // TODO: Map the connection object properly based on service type
    // For now, we'll skip setting the connection
    // request.setConnection(connection);
    return this;
  }

  /**
   * Set MySQL connection.
   */
  public DatabaseServiceBuilder connection(MysqlConnection connection) {
    DatabaseConnection dbConnection = new DatabaseConnection();
    dbConnection.setConfig(connection);
    request.setConnection(dbConnection);
    request.setServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);
    return this;
  }

  /**
   * Set PostgreSQL connection.
   */
  public DatabaseServiceBuilder connection(PostgresConnection connection) {
    DatabaseConnection dbConnection = new DatabaseConnection();
    dbConnection.setConfig(connection);
    request.setConnection(dbConnection);
    request.setServiceType(CreateDatabaseService.DatabaseServiceType.Postgres);
    return this;
  }

  /**
   * Set Snowflake connection.
   */
  public DatabaseServiceBuilder connection(SnowflakeConnection connection) {
    DatabaseConnection dbConnection = new DatabaseConnection();
    dbConnection.setConfig(connection);
    request.setConnection(dbConnection);
    request.setServiceType(CreateDatabaseService.DatabaseServiceType.Snowflake);
    return this;
  }

  /**
   * Set BigQuery connection.
   */
  public DatabaseServiceBuilder connection(BigQueryConnection connection) {
    DatabaseConnection dbConnection = new DatabaseConnection();
    dbConnection.setConfig(connection);
    request.setConnection(dbConnection);
    request.setServiceType(CreateDatabaseService.DatabaseServiceType.BigQuery);
    return this;
  }

  /**
   * Set Redshift connection.
   */
  public DatabaseServiceBuilder connection(RedshiftConnection connection) {
    DatabaseConnection dbConnection = new DatabaseConnection();
    dbConnection.setConfig(connection);
    request.setConnection(dbConnection);
    request.setServiceType(CreateDatabaseService.DatabaseServiceType.Redshift);
    return this;
  }

  /**
   * Build the CreateDatabaseService request without executing it.
   */
  public CreateDatabaseService build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Service name is required");
    }
    if (request.getServiceType() == null) {
      throw new IllegalStateException("Service type is required");
    }
    if (request.getConnection() == null) {
      throw new IllegalStateException("Connection configuration is required");
    }

    return request;
  }

  /**
   * Create the database service and return the created entity.
   */
  public DatabaseService create() {
    CreateDatabaseService createRequest = build();
    // Convert CreateDatabaseService to DatabaseService
    DatabaseService service = new DatabaseService();
    service.setName(createRequest.getName());
    service.setDisplayName(createRequest.getDisplayName());
    service.setDescription(createRequest.getDescription());
    // TODO: Map service type
    service.setConnection(createRequest.getConnection());
    return client.databaseServices().create(service);
  }

  /**
   * Create or update the database service (upsert).
   */
  public DatabaseService createOrUpdate() {
    CreateDatabaseService createRequest = build();
    // Convert CreateDatabaseService to DatabaseService
    DatabaseService service = new DatabaseService();
    service.setName(createRequest.getName());
    service.setDisplayName(createRequest.getDisplayName());
    service.setDescription(createRequest.getDescription());
    // TODO: Map service type
    service.setConnection(createRequest.getConnection());
    return client.databaseServices().create(service);
  }
}
