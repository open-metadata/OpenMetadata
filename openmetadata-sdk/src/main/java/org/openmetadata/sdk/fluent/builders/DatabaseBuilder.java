package org.openmetadata.sdk.fluent.builders;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating Database entities.
 *
 * <pre>
 * Database database = DatabaseBuilder.create(client)
 *     .name("analytics")
 *     .service(databaseService)
 *     .description("Analytics database")
 *     .create();
 * </pre>
 */
public class DatabaseBuilder {
  private final OpenMetadataClient client;
  private final CreateDatabase request;
  private EntityReference serviceRef;

  /**
   * Create a new DatabaseBuilder with the given client.
   */
  public static DatabaseBuilder create(OpenMetadataClient client) {
    return new DatabaseBuilder(client);
  }

  public DatabaseBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDatabase();
  }

  /**
   * Set the database name (required).
   */
  public DatabaseBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the database display name.
   */
  public DatabaseBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the database description.
   */
  public DatabaseBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set the database service by direct reference.
   */
  public DatabaseBuilder service(DatabaseService service) {
    this.serviceRef = toEntityReference(service);
    request.setService(
        this.serviceRef.getFullyQualifiedName() != null
            ? this.serviceRef.getFullyQualifiedName()
            : this.serviceRef.getName());
    return this;
  }

  /**
   * Set the database service by ID.
   */
  public DatabaseBuilder serviceId(UUID serviceId) {
    this.serviceRef = new EntityReference().withId(serviceId).withType("databaseService");
    request.setService(
        this.serviceRef.getFullyQualifiedName() != null
            ? this.serviceRef.getFullyQualifiedName()
            : this.serviceRef.getName());
    return this;
  }

  /**
   * Set the database service by name.
   */
  public DatabaseBuilder serviceName(String serviceName) {
    this.serviceRef = new EntityReference().withName(serviceName).withType("databaseService");
    request.setService(
        this.serviceRef.getFullyQualifiedName() != null
            ? this.serviceRef.getFullyQualifiedName()
            : this.serviceRef.getName());
    return this;
  }

  /**
   * Set the database service by fully qualified name.
   */
  public DatabaseBuilder serviceFQN(String serviceFQN) {
    this.serviceRef =
        new EntityReference().withFullyQualifiedName(serviceFQN).withType("databaseService");
    request.setService(
        this.serviceRef.getFullyQualifiedName() != null
            ? this.serviceRef.getFullyQualifiedName()
            : this.serviceRef.getName());
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DatabaseBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDatabase request without executing it.
   */
  public CreateDatabase build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Database name is required");
    }
    if (serviceRef == null) {
      throw new IllegalStateException("Database service reference is required");
    }

    return request;
  }

  /**
   * Create the database and return the created entity.
   */
  public Database create() {
    return client.databases().create(build());
  }

  // ==================== Helper Methods ====================

  private EntityReference toEntityReference(DatabaseService service) {
    return new EntityReference()
        .withId(service.getId())
        .withName(service.getName())
        .withFullyQualifiedName(service.getFullyQualifiedName())
        .withType("databaseService");
  }
}
