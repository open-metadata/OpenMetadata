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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.PostCommitActionQueue;

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
    RdfProjectionHealth.markReady();
    mockRepository = Mockito.mock(RdfRepository.class);
    when(mockRepository.isEnabled()).thenReturn(true);
    originalRepository = swapRdfRepository(mockRepository);
  }

  @Test
  @DisplayName("RDF writes touching the same entity id run in submission order")
  void writesForSameEntityIdAreSequenced() throws Exception {
    UUID termId = UUID.randomUUID();
    UUID relatedTermId = UUID.randomUUID();
    EntityInterface entity = Mockito.mock(EntityInterface.class);
    when(entity.getId()).thenReturn(termId);

    CountDownLatch updateStarted = new CountDownLatch(1);
    CountDownLatch releaseUpdate = new CountDownLatch(1);
    CountDownLatch relationStarted = new CountDownLatch(1);
    AtomicBoolean relationRan = new AtomicBoolean(false);
    List<String> events = Collections.synchronizedList(new ArrayList<>());

    doAnswer(
            ignored -> {
              events.add("update-start");
              updateStarted.countDown();
              assertFalse(relationRan.get());
              assertTrue(releaseUpdate.await(5, TimeUnit.SECONDS));
              events.add("update-end");
              return null;
            })
        .when(mockRepository)
        .createOrUpdate(entity);
    doAnswer(
            ignored -> {
              relationRan.set(true);
              events.add("relation");
              relationStarted.countDown();
              return null;
            })
        .when(mockRepository)
        .addGlossaryTermRelation(termId, relatedTermId, "relatedTo");

    try {
      RdfUpdater.updateEntity(entity);
      assertTrue(updateStarted.await(5, TimeUnit.SECONDS));

      RdfUpdater.addGlossaryTermRelation(termId, relatedTermId, "relatedTo");
      assertFalse(relationStarted.await(250, TimeUnit.MILLISECONDS));

      releaseUpdate.countDown();
      assertTrue(relationStarted.await(5, TimeUnit.SECONDS));
      Awaitility.await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(
              () -> assertEquals(List.of("update-start", "update-end", "relation"), events));
    } finally {
      releaseUpdate.countDown();
    }
  }

  @Test
  @DisplayName("RDF storage writes never exceed the configured concurrency bound")
  void concurrentWritesAreBounded() throws InterruptedException {
    final int capacity = RdfUpdater.maxConcurrentWrites();
    final BlockingWriteProbe probe = new BlockingWriteProbe(capacity, capacity + 4);
    configureBlockingWrites(probe);
    assertBoundedExecution(probe);
    verify(mockRepository, times(probe.totalWrites())).createOrUpdate(any(EntityInterface.class));
    assertEquals(capacity, probe.maximumConcurrentWrites());
  }

  private void configureBlockingWrites(final BlockingWriteProbe probe) {
    doAnswer(
            ignored -> {
              probe.block();
              return null;
            })
        .when(mockRepository)
        .createOrUpdate(any(EntityInterface.class));
  }

  private static void assertBoundedExecution(final BlockingWriteProbe probe)
      throws InterruptedException {
    try {
      mockEntities(probe.totalWrites()).forEach(RdfUpdater::updateEntity);
      assertTrue(probe.awaitCapacity(Duration.ofSeconds(5)));
      assertFalse(probe.awaitAllWrites(Duration.ofMillis(250)));
    } finally {
      probe.releaseWrites();
    }
    assertTrue(probe.awaitAllWrites(Duration.ofSeconds(5)));
    Awaitility.await().atMost(Duration.ofSeconds(5)).until(() -> probe.activeWrites() == 0);
  }

  @AfterEach
  void tearDown() throws Exception {
    PostCommitActionQueue.clear();
    RdfProjectionHealth.markReady();
    swapRdfRepository(originalRepository);
  }

  @Test
  @DisplayName("A failed incremental write degrades RDF projection health")
  void failedIncrementalWriteDegradesProjectionHealth() {
    final EntityInterface entity = Mockito.mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    doAnswer(
            ignored -> {
              throw new IllegalStateException("storage unavailable");
            })
        .when(mockRepository)
        .createOrUpdate(entity);

    RdfUpdater.updateEntity(entity);

    Awaitility.await()
        .atMost(Duration.ofSeconds(5))
        .untilAsserted(() -> assertTrue(RdfProjectionHealth.isDegraded()));
  }

  @Test
  @DisplayName("RDF submissions wait for the surrounding database transaction to commit")
  void rdfSubmissionIsDeferredUntilCommit() {
    UUID termId = UUID.randomUUID();
    UUID relatedTermId = UUID.randomUUID();
    PostCommitActionQueue.begin();

    RdfUpdater.addGlossaryTermRelation(termId, relatedTermId, "relatedTo");

    verify(mockRepository, never()).addGlossaryTermRelation(any(), any(), any());
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    Awaitility.await()
        .atMost(Duration.ofSeconds(5))
        .untilAsserted(
            () ->
                verify(mockRepository).addGlossaryTermRelation(termId, relatedTermId, "relatedTo"));
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

  private static List<EntityInterface> mockEntities(final int count) {
    return IntStream.range(0, count)
        .mapToObj(
            ignored -> {
              final EntityInterface entity = Mockito.mock(EntityInterface.class);
              when(entity.getId()).thenReturn(UUID.randomUUID());
              return entity;
            })
        .toList();
  }

  private static final class BlockingWriteProbe {
    private final int totalWrites;
    private final CountDownLatch capacityReached;
    private final CountDownLatch allWritesStarted;
    private final CountDownLatch releaseWrites = new CountDownLatch(1);
    private final AtomicInteger activeWrites = new AtomicInteger();
    private final AtomicInteger maximumConcurrentWrites = new AtomicInteger();

    private BlockingWriteProbe(final int capacity, final int totalWrites) {
      this.totalWrites = totalWrites;
      capacityReached = new CountDownLatch(capacity);
      allWritesStarted = new CountDownLatch(totalWrites);
    }

    private void block() throws InterruptedException {
      final int concurrentWrites = activeWrites.incrementAndGet();
      maximumConcurrentWrites.accumulateAndGet(concurrentWrites, Math::max);
      capacityReached.countDown();
      allWritesStarted.countDown();
      try {
        assertTrue(releaseWrites.await(5, TimeUnit.SECONDS));
      } finally {
        activeWrites.decrementAndGet();
      }
    }

    private boolean awaitCapacity(final Duration timeout) throws InterruptedException {
      return capacityReached.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    private boolean awaitAllWrites(final Duration timeout) throws InterruptedException {
      return allWritesStarted.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    private void releaseWrites() {
      releaseWrites.countDown();
    }

    private int activeWrites() {
      return activeWrites.get();
    }

    private int maximumConcurrentWrites() {
      return maximumConcurrentWrites.get();
    }

    private int totalWrites() {
      return totalWrites;
    }
  }
}
