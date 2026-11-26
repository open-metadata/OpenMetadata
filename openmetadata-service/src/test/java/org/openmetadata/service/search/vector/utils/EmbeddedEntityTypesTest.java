package org.openmetadata.service.search.vector.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class EmbeddedEntityTypesTest {

  @Test
  void dataAssetsAreEveryEmbeddedTypeExceptOntologyTerms() {
    List<String> withoutTerms =
        EmbeddedEntityTypes.ALL.stream()
            .filter(type -> !Entity.ONTOLOGY_CONCEPT.equals(type))
            .filter(type -> !Entity.ONTOLOGY_PROPERTY.equals(type))
            .toList();

    assertEquals(withoutTerms, EmbeddedEntityTypes.DATA_ASSETS);
  }

  @Test
  void lookupsIgnoreCase() {
    assertTrue(EmbeddedEntityTypes.isEmbedded("glossaryTerm"));
    assertTrue(EmbeddedEntityTypes.isEmbedded("GLOSSARYTERM"));
    assertTrue(EmbeddedEntityTypes.isDataAsset("glossaryterm"));
    assertTrue(EmbeddedEntityTypes.isEmbedded("OntologyConcept"));
    assertFalse(EmbeddedEntityTypes.isDataAsset("OntologyConcept"));
  }

  @Test
  void lookupsRejectTypesThatAreNotEmbedded() {
    assertFalse(EmbeddedEntityTypes.isEmbedded(Entity.USER));
    assertFalse(EmbeddedEntityTypes.isDataAsset(Entity.USER));
    assertFalse(EmbeddedEntityTypes.isEmbedded(null));
    assertFalse(EmbeddedEntityTypes.isDataAsset(null));
  }
}
