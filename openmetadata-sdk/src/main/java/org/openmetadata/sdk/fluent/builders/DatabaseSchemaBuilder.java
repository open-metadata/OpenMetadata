package org.openmetadata.sdk.fluent.builders;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent builder for creating DatabaseSchema entities.
 *
 * <pre>
 * DatabaseSchema schema = DatabaseSchemaBuilder.create(client)
 *     .name("public")
 *     .database(database)
 *     .description("Public schema")
 *     .create();
 * </pre>
 */
public class DatabaseSchemaBuilder {
  private final OpenMetadataClient client;
  private final CreateDatabaseSchema request;
  private EntityReference databaseRef;

  public DatabaseSchemaBuilder(OpenMetadataClient client) {
    this.client = client;
    this.request = new CreateDatabaseSchema();
  }

  /**
   * Set the schema name (required).
   */
  public DatabaseSchemaBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the schema display name.
   */
  public DatabaseSchemaBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the schema description.
   */
  public DatabaseSchemaBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set the database by direct reference.
   */
  public DatabaseSchemaBuilder database(Database database) {
    this.databaseRef = toEntityReference(database);
    request.setDatabase(
        this.databaseRef.getFullyQualifiedName() != null
            ? this.databaseRef.getFullyQualifiedName()
            : this.databaseRef.getName());
    return this;
  }

  /**
   * Set the database by ID.
   */
  public DatabaseSchemaBuilder databaseId(UUID databaseId) {
    this.databaseRef = new EntityReference().withId(databaseId).withType("database");
    request.setDatabase(
        this.databaseRef.getFullyQualifiedName() != null
            ? this.databaseRef.getFullyQualifiedName()
            : this.databaseRef.getName());
    return this;
  }

  /**
   * Set the database by name.
   */
  public DatabaseSchemaBuilder databaseName(String databaseName) {
    this.databaseRef = new EntityReference().withName(databaseName).withType("database");
    request.setDatabase(
        this.databaseRef.getFullyQualifiedName() != null
            ? this.databaseRef.getFullyQualifiedName()
            : this.databaseRef.getName());
    return this;
  }

  /**
   * Set the database by fully qualified name.
   */
  public DatabaseSchemaBuilder databaseFQN(String databaseFQN) {
    this.databaseRef =
        new EntityReference().withFullyQualifiedName(databaseFQN).withType("database");
    request.setDatabase(
        this.databaseRef.getFullyQualifiedName() != null
            ? this.databaseRef.getFullyQualifiedName()
            : this.databaseRef.getName());
    return this;
  }

  /**
   * Set custom extension data.
   */
  public DatabaseSchemaBuilder extension(Object extension) {
    return this;
  }

  /**
   * Build the CreateDatabaseSchema request without executing it.
   */
  public CreateDatabaseSchema build() {
    // Validate required fields
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Schema name is required");
    }
    if (databaseRef == null) {
      throw new IllegalStateException("Database reference is required");
    }

    return request;
  }

  /**
   * Create the database schema and return the created entity.
   */
  public DatabaseSchema create() {
    CreateDatabaseSchema createRequest = build();
    // Convert CreateDatabaseSchema to DatabaseSchema
    DatabaseSchema entity = new DatabaseSchema();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.databaseSchemas().create(entity);
  }

  /**
   * Create or update the database schema (upsert).
   */
  public DatabaseSchema createOrUpdate() {
    CreateDatabaseSchema createRequest = build();
    // Convert CreateDatabaseSchema to DatabaseSchema
    DatabaseSchema entity = new DatabaseSchema();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.databaseSchemas().upsert(entity);
  }

  // ==================== Helper Methods ====================

  private EntityReference toEntityReference(Database database) {
    return new EntityReference()
        .withId(database.getId())
        .withName(database.getName())
        .withFullyQualifiedName(database.getFullyQualifiedName())
        .withType("database");
  }
}
