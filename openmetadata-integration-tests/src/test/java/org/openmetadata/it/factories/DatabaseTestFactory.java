package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Factory for creating Database entities in integration tests.
 *
 * Migrated from: org.openmetadata.service.resources.databases.DatabaseResourceTest
 * Provides namespace-isolated entity creation with consistent patterns.
 */
public class DatabaseTestFactory {

  /**
   * Create a database with default settings.
   */
  public static Database create(OpenMetadataClient client, TestNamespace ns, String serviceFqn) {

    String name = ns.prefix("db");
    CreateDatabase req = new CreateDatabase();
    req.setName(name);
    req.setService(serviceFqn);
    req.setDescription("Test database created by integration test");
    return client.databases().create(req);
  }

  /**
   * Create database with custom name.
   */
  public static Database createWithName(
      OpenMetadataClient client, TestNamespace ns, String serviceFqn, String baseName) {

    String name = ns.prefix(baseName);
    CreateDatabase req = new CreateDatabase();
    req.setName(name);
    req.setService(serviceFqn);
    return client.databases().create(req);
  }

  /**
   * Attempt to create database without service (for negative testing).
   * This should throw an exception.
   */
  public static Database createWithoutService(OpenMetadataClient client, TestNamespace ns) {
    String name = ns.prefix("db");
    CreateDatabase req = new CreateDatabase();
    req.setName(name);
    // Missing service - should throw exception
    return client.databases().create(req);
  }

  /**
   * Get database by ID.
   */
  public static Database getById(OpenMetadataClient client, String id) {
    return client.databases().get(id);
  }

  /**
   * Update database description.
   */
  public static Database updateDescription(
      OpenMetadataClient client, String id, String description) {
    Database db = client.databases().get(id);
    db.setDescription(description);
    return client.databases().update(id, db);
  }

  /**
   * Delete database.
   */
  public static void delete(OpenMetadataClient client, String id) {
    client.databases().delete(id);
  }
}
