package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.fluent.Databases;

/**
 * Factory for creating Database entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link Databases}. Ensure
 * {@code Databases.setDefaultClient(client)} is called before using these methods.
 */
public class DatabaseTestFactory {

  /**
   * Create a database with default settings using fluent API.
   */
  public static Database create(TestNamespace ns, String serviceFqn) {
    return Databases.create()
        .name(ns.prefix("db"))
        .in(serviceFqn)
        .withDescription("Test database created by integration test")
        .execute();
  }

  /**
   * Create database with custom name using fluent API.
   */
  public static Database createWithName(TestNamespace ns, String serviceFqn, String baseName) {
    return Databases.create().name(ns.prefix(baseName)).in(serviceFqn).execute();
  }
}
