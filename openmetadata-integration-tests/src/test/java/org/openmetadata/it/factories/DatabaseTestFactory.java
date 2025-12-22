package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.DatabaseBuilder;

/**
 * Factory for creating Database entities in integration tests using fluent API.
 *
 * <p>Migrated from: org.openmetadata.service.resources.databases.DatabaseResourceTest Provides
 * namespace-isolated entity creation with consistent patterns.
 */
public class DatabaseTestFactory {

  /**
   * Create a database with default settings using fluent builder.
   */
  public static Database create(OpenMetadataClient client, TestNamespace ns, String serviceFqn) {
    return DatabaseBuilder.create(client)
        .name(ns.prefix("db"))
        .serviceFQN(serviceFqn)
        .description("Test database created by integration test")
        .create();
  }

  /**
   * Create database with custom name using fluent builder.
   */
  public static Database createWithName(
      OpenMetadataClient client, TestNamespace ns, String serviceFqn, String baseName) {
    return DatabaseBuilder.create(client).name(ns.prefix(baseName)).serviceFQN(serviceFqn).create();
  }

  /**
   * Attempt to create database without service (for negative testing). This should throw an
   * exception because service is required.
   */
  public static Database createWithoutService(OpenMetadataClient client, TestNamespace ns) {
    // Build without service - will throw IllegalStateException from builder
    return DatabaseBuilder.create(client).name(ns.prefix("db")).create();
  }

  /** Get database by ID. */
  public static Database getById(OpenMetadataClient client, String id) {
    return client.databases().get(id);
  }

  /** Update database description. */
  public static Database updateDescription(
      OpenMetadataClient client, String id, String description) {
    Database db = client.databases().get(id);
    db.setDescription(description);
    return client.databases().update(id, db);
  }

  /** Delete database. */
  public static void delete(OpenMetadataClient client, String id) {
    client.databases().delete(id);
  }
}
