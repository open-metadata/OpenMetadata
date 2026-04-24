package org.openmetadata.it.factories;

import java.util.List;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.fluent.GlossaryTerms;

/**
 * Factory for creating GlossaryTerm entities in integration tests using fluent API.
 *
 * <p>Uses the static fluent API from {@link GlossaryTerms}. Ensure {@code
 * GlossaryTerms.setDefaultClient(client)} is called before using these methods (handled by
 * SdkClients.initializeFluentAPIs).
 */
public class GlossaryTermTestFactory {

  /**
   * Create a glossary term with default settings using fluent API.
   */
  public static GlossaryTerm createSimple(TestNamespace ns, Glossary glossary) {
    return GlossaryTerms.create()
        .name(ns.prefix("term"))
        .in(glossary.getFullyQualifiedName())
        .withDescription("Test term")
        .execute();
  }

  /**
   * Create glossary term with custom name using fluent API.
   */
  public static GlossaryTerm createWithName(TestNamespace ns, Glossary glossary, String baseName) {
    return GlossaryTerms.create()
        .name(ns.prefix(baseName))
        .in(glossary.getFullyQualifiedName())
        .withDescription("Test term: " + baseName)
        .execute();
  }

  /**
   * Create glossary term with description using fluent API.
   */
  public static GlossaryTerm createWithDescription(
      TestNamespace ns, Glossary glossary, String description) {
    return GlossaryTerms.create()
        .name(ns.prefix("term"))
        .in(glossary.getFullyQualifiedName())
        .withDescription(description)
        .execute();
  }

  /**
   * Create glossary term under a parent term using fluent API.
   */
  public static GlossaryTerm createChild(
      TestNamespace ns, Glossary glossary, GlossaryTerm parent, String baseName) {
    return GlossaryTerms.create()
        .name(ns.prefix(baseName))
        .in(glossary.getFullyQualifiedName())
        .under(parent.getFullyQualifiedName())
        .withDescription("Child term of " + parent.getName())
        .execute();
  }

  /**
   * Create glossary term with synonyms using fluent API.
   */
  public static GlossaryTerm createWithSynonyms(
      TestNamespace ns, Glossary glossary, String baseName, List<String> synonyms) {
    return GlossaryTerms.create()
        .name(ns.prefix(baseName))
        .in(glossary.getFullyQualifiedName())
        .withDescription("Term with synonyms")
        .withSynonyms(synonyms)
        .execute();
  }

  /**
   * Create glossary term with related terms using fluent API.
   *
   * @param relatedTermFqns List of fully qualified names of related terms
   */
  public static GlossaryTerm createWithRelatedTerms(
      TestNamespace ns, Glossary glossary, String baseName, List<String> relatedTermFqns) {
    return GlossaryTerms.create()
        .name(ns.prefix(baseName))
        .in(glossary.getFullyQualifiedName())
        .withDescription("Term with related terms")
        .withRelatedTerms(relatedTermFqns)
        .execute();
  }

  /**
   * Create glossary term with display name using fluent API.
   */
  public static GlossaryTerm createWithDisplayName(
      TestNamespace ns, Glossary glossary, String baseName, String displayName) {
    return GlossaryTerms.create()
        .name(ns.prefix(baseName))
        .in(glossary.getFullyQualifiedName())
        .withDisplayName(displayName)
        .withDescription("Term with display name")
        .execute();
  }

  /**
   * Delete a glossary term by ID (hard delete with recursive).
   */
  public static void delete(GlossaryTerm term) {
    GlossaryTerms.find(term.getId()).delete().recursively().permanently().confirm();
  }
}
