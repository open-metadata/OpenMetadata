/*
 *  Copyright 2025 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.rdf;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;

/**
 * Unit tests for {@link RdfUpdater}, specifically the glossary-term ⇔
 * glossary-term {@code RELATED_TO} short-circuit. The generic relationship
 * hooks unconditionally wrote {@code om:relatedTo} on top of the typed
 * predicate ({@code skos:exactMatch}, {@code skos:broader}, …) emitted by
 * {@link RdfRepository#addGlossaryTermRelation}, leaving a residual edge
 * after a user changed the relation type from "relatedTo" to "broader".
 * Verifies the short-circuit fires for the targeted shape and only for that
 * shape, so other relationships (CONTAINS, OWNS, cross-entity RELATED_TO,
 * etc.) still flow through the underlying repository.
 */
class RdfUpdaterTest {

  private RdfRepository originalRepository;
  private RdfRepository mockRepository;

  @BeforeEach
  void setUp() throws Exception {
    mockRepository = Mockito.mock(RdfRepository.class);
    when(mockRepository.isEnabled()).thenReturn(true);
    originalRepository = swapRdfRepository(mockRepository);
  }

  @AfterEach
  void tearDown() throws Exception {
    swapRdfRepository(originalRepository);
  }

  @Nested
  @DisplayName("addRelationship short-circuits glossaryTerm⇔glossaryTerm RELATED_TO")
  class AddRelationship {

    @Test
    @DisplayName("glossaryTerm RELATED_TO glossaryTerm should NOT reach the repository")
    void glossaryTermRelatedToIsShortCircuited() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity(Entity.GLOSSARY_TERM)
              .withToEntity(Entity.GLOSSARY_TERM)
              .withRelationshipType(Relationship.RELATED_TO);

      RdfUpdater.addRelationship(rel);

      verify(mockRepository, never()).addRelationship(any());
    }

    @Test
    @DisplayName("Cross-entity RELATED_TO (e.g. table → glossaryTerm) still flows through")
    void crossEntityRelatedToIsNotShortCircuited() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity(Entity.TABLE)
              .withToEntity(Entity.GLOSSARY_TERM)
              .withRelationshipType(Relationship.RELATED_TO);

      RdfUpdater.addRelationship(rel);

      Awaitility.await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> verify(mockRepository, times(1)).addRelationship(rel));
    }

    @Test
    @DisplayName("Non-RELATED_TO between two glossary terms still flows through")
    void otherRelationshipBetweenGlossaryTermsIsNotShortCircuited() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity(Entity.GLOSSARY_TERM)
              .withToEntity(Entity.GLOSSARY_TERM)
              .withRelationshipType(Relationship.CONTAINS);

      RdfUpdater.addRelationship(rel);

      Awaitility.await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> verify(mockRepository, times(1)).addRelationship(rel));
    }
  }

  @Nested
  @DisplayName("removeRelationship short-circuits glossaryTerm⇔glossaryTerm RELATED_TO")
  class RemoveRelationship {

    @Test
    @DisplayName("glossaryTerm RELATED_TO glossaryTerm should NOT reach the repository")
    void glossaryTermRelatedToIsShortCircuited() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity(Entity.GLOSSARY_TERM)
              .withToEntity(Entity.GLOSSARY_TERM)
              .withRelationshipType(Relationship.RELATED_TO);

      RdfUpdater.removeRelationship(rel);

      verify(mockRepository, never()).removeRelationship(any());
    }

    @Test
    @DisplayName("Cross-entity RELATED_TO still flows through to repository")
    void crossEntityRelatedToIsNotShortCircuited() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity(Entity.TABLE)
              .withToEntity(Entity.GLOSSARY_TERM)
              .withRelationshipType(Relationship.RELATED_TO);

      RdfUpdater.removeRelationship(rel);

      Awaitility.await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> verify(mockRepository, times(1)).removeRelationship(rel));
    }
  }

  @Nested
  @DisplayName("entity types excluded from RDF (aiChart) are never written")
  class ExcludedEntityTypes {

    @Test
    @DisplayName("deleteEntity for an excluded type never reaches the repository")
    void deleteExcludedEntityIsSkipped() {
      EntityReference ref = new EntityReference().withId(UUID.randomUUID()).withType("aiChart");

      RdfUpdater.deleteEntity(ref);

      verify(mockRepository, never()).delete(any());
    }

    @Test
    @DisplayName("deleteEntity for a normal type still flows through")
    void deleteNormalEntityFlowsThrough() {
      EntityReference ref = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);

      RdfUpdater.deleteEntity(ref);

      Awaitility.await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> verify(mockRepository, times(1)).delete(ref));
    }

    @Test
    @DisplayName("addRelationship with an excluded endpoint never reaches the repository")
    void addRelationshipWithExcludedEndpointIsSkipped() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity(Entity.DASHBOARD)
              .withToEntity("aiChart")
              .withRelationshipType(Relationship.CONTAINS);

      RdfUpdater.addRelationship(rel);

      verify(mockRepository, never()).addRelationship(any());
    }

    @Test
    @DisplayName("removeRelationship with an excluded endpoint never reaches the repository")
    void removeRelationshipWithExcludedEndpointIsSkipped() {
      EntityRelationship rel =
          new EntityRelationship()
              .withFromId(UUID.randomUUID())
              .withToId(UUID.randomUUID())
              .withFromEntity("aiChart")
              .withToEntity(Entity.DASHBOARD)
              .withRelationshipType(Relationship.CONTAINS);

      RdfUpdater.removeRelationship(rel);

      verify(mockRepository, never()).removeRelationship(any());
    }
  }

  /**
   * Replace the private static {@code rdfRepository} field via reflection
   * and return the previous value so tests can restore it. Required because
   * RdfUpdater intentionally exposes no setter — the singleton is wired
   * via {@link RdfUpdater#initialize(org.openmetadata.schema.api.configuration.rdf.RdfConfiguration)}
   * which would actually connect to Fuseki.
   */
  private static RdfRepository swapRdfRepository(RdfRepository replacement) throws Exception {
    Field field = RdfUpdater.class.getDeclaredField("rdfRepository");
    field.setAccessible(true);
    RdfRepository previous = (RdfRepository) field.get(null);
    field.set(null, replacement);
    return previous;
  }
}
