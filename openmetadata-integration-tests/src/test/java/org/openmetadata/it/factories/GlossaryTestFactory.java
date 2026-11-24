package org.openmetadata.it.factories;

import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.sdk.fluent.Glossaries;
import org.openmetadata.service.Entity;

/**
 * Factory for creating Glossary entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link Glossaries}. Ensure {@code
 * Glossaries.setDefaultClient(client)} is called before using these methods (handled by
 * SdkClients.initializeFluentAPIs).
 */
public class GlossaryTestFactory {
  public static final String STATUS_TEST_GLOSSARY_PREFIX = "status_fixture_glossary";

  /** Glossary whose terms the test bootstrap excludes from automatic approval. */
  public static Glossary createForStatusTests(TestNamespace ns) {
    return createWithName(ns, STATUS_TEST_GLOSSARY_PREFIX);
  }

  /**
   * Create a glossary with default settings using fluent API.
   */
  public static Glossary createSimple(TestNamespace ns) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        Glossaries.create().name(ns.prefix("glossary")).withDescription("Test glossary").execute());
  }

  /**
   * Create glossary with custom name using fluent API.
   */
  public static Glossary createWithName(TestNamespace ns, String baseName) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        Glossaries.create()
            .name(ns.prefix(baseName))
            .withDescription("Test glossary: " + baseName)
            .execute());
  }

  /**
   * Create glossary with description using fluent API.
   */
  public static Glossary createWithDescription(TestNamespace ns, String description) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        Glossaries.create().name(ns.prefix("glossary")).withDescription(description).execute());
  }

  /**
   * Create glossary with display name using fluent API.
   */
  public static Glossary createWithDisplayName(
      TestNamespace ns, String baseName, String displayName) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        Glossaries.create()
            .name(ns.prefix(baseName))
            .withDisplayName(displayName)
            .withDescription("Test glossary with display name")
            .execute());
  }

  /**
   * Delete a glossary by ID (hard delete with recursive).
   */
  public static void delete(Glossary glossary) {
    Glossaries.find(glossary.getId()).delete().recursively().permanently().confirm();
  }
}
