package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

/**
 * Pins the {@code reembed} CLI's term-type exclusion. Ontology term embeddings are rebuilt only via
 * the release-aware reindex path; the {@code reembed} CLI must skip them. {@code reembedEntity}
 * refuses terms defensively as well, so this predicate and the vector-service guard are
 * belt-and-braces.
 */
class OpenMetadataOperationsReembedEligibilityTest {

  @Test
  void ontologyConceptsAndPropertiesAreNotReembeddable() {
    assertFalse(
        OpenMetadataOperations.isReembedableEntityType(Entity.ONTOLOGY_CONCEPT),
        "ontologyConcept must be rebuilt via the release-aware reindex path, not reembed");
    assertFalse(
        OpenMetadataOperations.isReembedableEntityType(Entity.ONTOLOGY_PROPERTY),
        "ontologyProperty must be rebuilt via the release-aware reindex path, not reembed");
  }

  @Test
  void dataAssetEntitiesRemainReembeddable() {
    for (String type :
        new String[] {"table", "glossaryTerm", "chart", "dashboard", "topic", "contextMemory"}) {
      assertTrue(
          OpenMetadataOperations.isReembedableEntityType(type),
          type + " must still be re-embeddable; only ontology terms are excluded");
    }
  }

  @Test
  void isReembedableEntityTypeIsCaseInsensitiveForTerms() {
    // OntologyTermSearch.isTerm uses equalsIgnoreCase; the CLI relies on the same casing
    // EmbeddedEntityTypes.ALL declares, but guard against a caller passing a variant.
    assertFalse(OpenMetadataOperations.isReembedableEntityType("OntologyConcept"));
    assertFalse(OpenMetadataOperations.isReembedableEntityType("ONTOLOGYPROPERTY"));
  }
}
