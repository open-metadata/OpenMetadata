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
package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/**
 * Unit tests for {@link RdfBatchProcessor#processEntities}. Pins the three
 * branches of the bulk-write fast path that the prior reviews flagged as the
 * highest-complexity uncovered logic in the PR:
 *
 * <ol>
 *   <li>Bulk write succeeds → indexer reports all N entities indexed.</li>
 *   <li>Bulk write fails with a payload-shape error → bisect fallback splits
 *       the batch and isolates the bad row so other entities still land.</li>
 *   <li>Bulk write fails with a tripped circuit breaker → bisection is
 *       SKIPPED (every attempt would hit the same breaker); the whole batch
 *       is marked failed once, no further calls.</li>
 * </ol>
 *
 * Also pins the cause-chain walk in {@code isCircuitBreakerOpen} so a
 * breaker exception wrapped by {@code RdfRepository.bulkCreateOrUpdate}'s
 * {@code RuntimeException} re-throw is still detected.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("RdfBatchProcessor.processEntities branching tests")
class RdfBatchProcessorTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private EntityRelationshipDAO relationshipDAO;
  @Mock private RdfRepository rdfRepository;

  private RdfBatchProcessor processor;

  @BeforeEach
  void setUp() {
    // The relationship side-path makes DB calls regardless of the entity
    // write outcome. Stub the DAOs to return empty results so the test
    // focuses purely on the bulk → fallback → breaker decision tree.
    lenient().when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    lenient()
        .when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
        .thenReturn(List.of());
    lenient()
        .when(relationshipDAO.findFromBatch(anyList(), anyInt(), any(Include.class)))
        .thenReturn(List.of());
    processor = new RdfBatchProcessor(collectionDAO, rdfRepository);
  }

  private EntityInterface mockEntity() {
    EntityInterface e = mock(EntityInterface.class);
    lenient().when(e.getId()).thenReturn(UUID.randomUUID());
    return e;
  }

  @Test
  @DisplayName("happy path: bulk write succeeds; all entities counted as success, no fallback")
  void bulkSuccessReportsAllSuccess() {
    List<EntityInterface> entities = List.of(mockEntity(), mockEntity(), mockEntity());

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(3, result.successCount(), "all entities should be indexed");
    assertEquals(0, result.failedCount(), "no entity-level failure on the happy path");
    assertNull(result.lastError());
    // Bulk path took the write; no singleton bulk fallback must fire.
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);
  }

  @Test
  @DisplayName("pre-translation failures remain visible when the writable entities succeed")
  void preTranslationFailureIsNotOverwrittenByWriteSuccess() {
    EntityInterface translated = mockEntity();
    EntityInterface untranslated = mockEntity();
    RdfStorageInterface.EntityWriteRequest request =
        new RdfStorageInterface.EntityWriteRequest("table", translated.getId(), null);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntitiesPreTranslated(
            "table", List.of(translated, untranslated), List.of(request), null);

    assertEquals(1, result.successCount());
    assertEquals(1, result.failedCount());
    assertTrue(result.lastError().contains("RDF translation failed"));
    verify(rdfRepository).bulkStorePreTranslated(List.of(request), RdfWriteMode.RECONCILE);
  }

  @Test
  @DisplayName("bulk failure (non-breaker): bisect isolates the bad row, others succeed")
  void bulkFailureBisectIsolatesBadRow() {
    EntityInterface a = mockEntity();
    EntityInterface b = mockEntity();
    EntityInterface c = mockEntity();
    List<EntityInterface> entities = List.of(a, b, c);

    // Any sub-batch containing the poison entity b fails (a real payload-shape
    // failure, NOT the circuit breaker); sub-batches without b succeed. Bisect
    // order for [a,b,c] is: [a,b,c] → [a] + [b,c] → [b] + [c].
    doThrow(new RuntimeException("payload broken on b"))
        .when(rdfRepository)
        .bulkCreateOrUpdate(
            argThat((List<? extends EntityInterface> list) -> list != null && list.contains(b)),
            eq(RdfWriteMode.RECONCILE));

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(2, result.successCount(), "a + c should succeed via bisect");
    assertEquals(1, result.failedCount(), "b should be the only failure");
    assertNotNull(result.lastError(), "lastError should carry b's failure");
    assertTrue(
        result.lastError().contains(b.getId().toString()),
        "lastError should include the failing entity's id");
    assertTrue(
        result.lastError().contains("payload broken on b"),
        "lastError should carry the underlying message");
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(List.of(a), RdfWriteMode.RECONCILE);
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(List.of(b, c), RdfWriteMode.RECONCILE);
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(List.of(b), RdfWriteMode.RECONCILE);
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(List.of(c), RdfWriteMode.RECONCILE);
  }

  @Test
  @DisplayName("per-source relationship isolation stops after maxRetries failed attempts")
  void perSourceIsolationStopsAfterMaxRetries() {
    processor =
        new RdfBatchProcessor(
            collectionDAO,
            rdfRepository,
            new RdfIndexingRunContext(RdfWriteMode.RECONCILE, Set.of(), null, null, 2));
    List<EntityInterface> entities =
        List.of(mockEntity(), mockEntity(), mockEntity(), mockEntity(), mockEntity());

    // The bulk relationship write fails, and so does every per-source retry: the
    // classic systemic failure that used to attempt all N sources at a timeout each.
    doThrow(new RuntimeException("relationship write failed"))
        .when(rdfRepository)
        .bulkAddRelationships(anyList(), any(), any(RdfWriteMode.class));

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    // 1 bulk attempt + at most maxRetries per-source attempts; the other sources are
    // marked failed without being attempted.
    verify(rdfRepository, times(3)).bulkAddRelationships(anyList(), any(), any(RdfWriteMode.class));
    assertEquals(5, result.successCount(), "entity writes are unaffected by relationship failures");
    assertTrue(result.relationshipFailureCount() >= 5, "every source is accounted as failed");
  }

  @Test
  @DisplayName("per-source isolation keeps going while attempts succeed")
  void perSourceIsolationNotPenalisedBySuccess() {
    processor =
        new RdfBatchProcessor(
            collectionDAO,
            rdfRepository,
            new RdfIndexingRunContext(RdfWriteMode.RECONCILE, Set.of(), null, null, 2));
    List<EntityInterface> entities =
        List.of(mockEntity(), mockEntity(), mockEntity(), mockEntity(), mockEntity());

    // Only the initial bulk write fails; every per-source retry succeeds, so the
    // failure budget is never consumed and all five sources are isolated.
    doThrow(new RuntimeException("bulk relationship write failed"))
        .doNothing()
        .when(rdfRepository)
        .bulkAddRelationships(anyList(), any(), any(RdfWriteMode.class));

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    verify(rdfRepository, times(6)).bulkAddRelationships(anyList(), any(), any(RdfWriteMode.class));
    assertEquals(0, result.relationshipFailureCount(), "successful isolation is not a failure");
  }

  @Test
  @DisplayName("maxRetries defaults to 3 and is taken from the app configuration when set")
  void maxRetriesComesFromAppConfiguration() {
    assertEquals(
        RdfIndexingRunContext.DEFAULT_MAX_RETRIES, RdfIndexingRunContext.resolveMaxRetries(null));
    assertEquals(7, RdfIndexingRunContext.resolveMaxRetries(7));
    assertEquals(0, RdfIndexingRunContext.resolveMaxRetries(0));
    assertEquals(0, RdfIndexingRunContext.resolveMaxRetries(-1));
  }

  @Test
  @DisplayName("breaker opening mid-bisect stops all further attempts, remainder marked failed")
  void breakerOpeningMidBisectStopsFurtherAttempts() {
    EntityInterface a = mockEntity();
    EntityInterface b = mockEntity();
    EntityInterface c = mockEntity();
    EntityInterface d = mockEntity();
    List<EntityInterface> entities = List.of(a, b, c, d);

    doThrow(new RuntimeException("bad model"))
        .when(rdfRepository)
        .bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);
    doThrow(new RdfStorageCircuitOpenException("bulkStoreEntities"))
        .when(rdfRepository)
        .bulkCreateOrUpdate(List.of(a, b), RdfWriteMode.RECONCILE);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(0, result.successCount());
    assertEquals(4, result.failedCount(), "left half failed on breaker, right half not attempted");
    verify(rdfRepository, never()).bulkCreateOrUpdate(List.of(c, d), RdfWriteMode.RECONCILE);
    verify(rdfRepository, never()).bulkCreateOrUpdate(List.of(a), RdfWriteMode.RECONCILE);
    verify(rdfRepository, never()).bulkCreateOrUpdate(List.of(b), RdfWriteMode.RECONCILE);
  }

  @Test
  @DisplayName("write budget exhaustion stops bisecting; remainder marked failed after one attempt")
  void writeBudgetExhaustionStopsBisecting() {
    List<EntityInterface> entities = List.of(mockEntity(), mockEntity(), mockEntity());
    when(rdfRepository.batchWriteBudgetMs()).thenReturn(1L);

    // Burn past the 1 ms budget inside the first (and only) bulk attempt so
    // the post-failure deadline check is deterministically expired.
    org.mockito.Mockito.doAnswer(
            inv -> {
              long spinUntil = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(5);
              while (System.nanoTime() < spinUntil) {
                Thread.onSpinWait();
              }
              throw new RuntimeException("slow failure");
            })
        .when(rdfRepository)
        .bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(0, result.successCount());
    assertEquals(3, result.failedCount());
    assertNotNull(result.lastError());
    assertTrue(
        result.lastError().contains("write budget exhausted"),
        "lastError should say the budget ended the cascade");
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(anyList(), any(RdfWriteMode.class));
  }

  @Test
  @DisplayName("bulk failure + circuit breaker open: fallback SKIPPED, batch marked failed once")
  void bulkFailureWithBreakerOpenSkipsFallback() {
    List<EntityInterface> entities = List.of(mockEntity(), mockEntity(), mockEntity());

    // The storage layer fast-fails with the typed breaker exception. The
    // bulk-fallback path MUST detect this and not retry per-entity (every
    // attempt would hit the same breaker).
    doThrow(new RdfStorageCircuitOpenException("bulkStoreEntities"))
        .when(rdfRepository)
        .bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(0, result.successCount());
    assertEquals(3, result.failedCount(), "whole batch should be marked failed");
    assertNotNull(result.lastError());
    assertTrue(
        result.lastError().contains("table batch"),
        "lastError prefix should identify the failed entity-type batch");
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);
  }

  @Test
  @DisplayName("breaker exception wrapped in RuntimeException is still detected via cause chain")
  void wrappedBreakerExceptionDetectedViaCauseChain() {
    List<EntityInterface> entities = List.of(mockEntity(), mockEntity());

    // RdfRepository.bulkCreateOrUpdate catches and re-throws as a generic
    // RuntimeException("Failed to bulk create/update entities in RDF", e)
    // — the breaker exception ends up TWO levels deep. The cause-chain
    // walk in isCircuitBreakerOpen must still find it.
    Throwable inner = new RdfStorageCircuitOpenException("bulkStoreEntities");
    Throwable wrapped = new RuntimeException("Failed to bulk create/update entities in RDF", inner);
    doThrow(wrapped).when(rdfRepository).bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("dashboard", entities, null);

    // Same as the unwrapped case: NO per-entity fallback.
    assertEquals(0, result.successCount());
    assertEquals(2, result.failedCount());
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);
  }

  @Test
  @DisplayName("stop signal raised BEFORE the bulk call skips writing entirely")
  void preBatchStopSignalSkipsBulkWrite() {
    List<EntityInterface> entities = List.of(mockEntity(), mockEntity());

    // Stop signal is hot before the loop checks it.
    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, () -> true);

    assertEquals(0, result.successCount());
    assertEquals(0, result.failedCount());
    verify(rdfRepository, never()).bulkCreateOrUpdate(anyList(), any(RdfWriteMode.class));
  }

  @Test
  @DisplayName("empty entity list short-circuits without touching the repository")
  void emptyEntityListShortCircuits() {
    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", List.of(), null);
    assertEquals(0, result.successCount());
    assertEquals(0, result.failedCount());
    verify(rdfRepository, never()).bulkCreateOrUpdate(anyList(), any(RdfWriteMode.class));
  }

  @Test
  @DisplayName(
      "bulk failure + stop signal raised mid-fallback: remaining per-entity attempts skipped")
  void stopSignalMidFallbackHonored() {
    EntityInterface a = mockEntity();
    EntityInterface b = mockEntity();
    EntityInterface c = mockEntity();
    List<EntityInterface> entities = List.of(a, b, c);

    doThrow(new RuntimeException("bad model"))
        .when(rdfRepository)
        .bulkCreateOrUpdate(entities, RdfWriteMode.RECONCILE);

    // Latch flips to true after the left-half attempt ([a]) succeeds. The
    // bisect must NOT attempt the right half ([b, c]) after that.
    java.util.concurrent.atomic.AtomicBoolean stop =
        new java.util.concurrent.atomic.AtomicBoolean(false);
    org.mockito.Mockito.doAnswer(
            inv -> {
              stop.set(true);
              return null;
            })
        .when(rdfRepository)
        .bulkCreateOrUpdate(eq(List.of(a)), eq(RdfWriteMode.RECONCILE));

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, stop::get);

    assertEquals(1, result.successCount(), "only a should have completed before stop");
    assertEquals(0, result.failedCount());
    verify(rdfRepository, atLeastOnce())
        .bulkCreateOrUpdate(eq(List.of(a)), eq(RdfWriteMode.RECONCILE));
    verify(rdfRepository, never()).bulkCreateOrUpdate(eq(List.of(b)), eq(RdfWriteMode.RECONCILE));
    verify(rdfRepository, never()).bulkCreateOrUpdate(eq(List.of(c)), eq(RdfWriteMode.RECONCILE));
  }

  @Test
  @DisplayName("relationships whose endpoint is an excluded entity type (aiChart) are filtered out")
  void relationshipsToExcludedEntityTypesAreSkipped() {
    EntityInterface dashboard = mockEntity();

    EntityRelationshipObject aiChartEdge =
        EntityRelationshipObject.builder()
            .fromId(dashboard.getId().toString())
            .toId(UUID.randomUUID().toString())
            .fromEntity("dashboard")
            .toEntity("aiChart")
            .relation(Relationship.CONTAINS.ordinal())
            .build();
    EntityRelationshipObject tableEdge =
        EntityRelationshipObject.builder()
            .fromId(dashboard.getId().toString())
            .toId(UUID.randomUUID().toString())
            .fromEntity("dashboard")
            .toEntity("table")
            .relation(Relationship.CONTAINS.ordinal())
            .build();

    when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
        .thenReturn(List.of(aiChartEdge, tableEdge));

    processor.processBatchRelationships("dashboard", List.of(dashboard));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<EntityRelationship>> captor = ArgumentCaptor.forClass(List.class);
    verify(rdfRepository).bulkAddRelationships(captor.capture(), any(), eq(RdfWriteMode.RECONCILE));

    List<EntityRelationship> stored = captor.getValue();
    assertEquals(1, stored.size(), "aiChart edge filtered; only the table edge remains");
    assertEquals("table", stored.get(0).getToEntity());
  }

  @Test
  @DisplayName("insert-only run context is propagated to entity and relationship bulk writes")
  void insertOnlyContextIsPropagated() {
    processor =
        new RdfBatchProcessor(
            collectionDAO,
            rdfRepository,
            new RdfIndexingRunContext(RdfWriteMode.INSERT_ONLY, Set.of("table")));
    List<EntityInterface> entities = List.of(mockEntity());

    processor.processEntities("table", entities, null);

    verify(rdfRepository).bulkCreateOrUpdate(entities, RdfWriteMode.INSERT_ONLY);
    verify(rdfRepository).bulkAddRelationships(anyList(), any(), eq(RdfWriteMode.INSERT_ONLY));
  }

  @Test
  @DisplayName("insert-only mode is preserved by bisected singleton writes")
  void insertOnlyModeIsPreservedByBisectedWrites() {
    processor =
        new RdfBatchProcessor(
            collectionDAO,
            rdfRepository,
            new RdfIndexingRunContext(RdfWriteMode.INSERT_ONLY, Set.of("table")));
    EntityInterface a = mockEntity();
    EntityInterface b = mockEntity();
    List<EntityInterface> entities = List.of(a, b);
    doThrow(new RuntimeException("bulk payload rejected"))
        .when(rdfRepository)
        .bulkCreateOrUpdate(entities, RdfWriteMode.INSERT_ONLY);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(2, result.successCount(), "both halves succeed after the bisect");
    assertEquals(0, result.failedCount());
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities, RdfWriteMode.INSERT_ONLY);
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(List.of(a), RdfWriteMode.INSERT_ONLY);
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(List.of(b), RdfWriteMode.INSERT_ONLY);
    // A singleton that fails is terminal — bisect never re-attempts at the
    // same size, unlike the old fallback which incidentally retried it.
  }

  @Test
  @DisplayName("incoming lineage is skipped when its source type is indexed in the same run")
  void incomingLineageIsDeduplicatedForIndexedSourceType() {
    processor =
        new RdfBatchProcessor(
            collectionDAO,
            rdfRepository,
            new RdfIndexingRunContext(RdfWriteMode.INSERT_ONLY, Set.of("table")));
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    EntityInterface from = mock(EntityInterface.class);
    EntityInterface to = mock(EntityInterface.class);
    when(from.getId()).thenReturn(fromId);
    when(to.getId()).thenReturn(toId);
    EntityRelationshipObject lineage = lineage(fromId, toId);
    when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
        .thenReturn(List.of(lineage));
    when(relationshipDAO.findFromBatch(anyList(), anyInt(), any(Include.class)))
        .thenReturn(List.of(lineage));

    processor.processBatchRelationships("table", List.of(from, to));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfRepository.LineageEdgeData>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(rdfRepository).bulkAddLineage(captor.capture(), eq(RdfWriteMode.INSERT_ONLY));
    assertEquals(1, captor.getValue().size());
    assertEquals(fromId, captor.getValue().get(0).fromId());
    assertEquals(toId, captor.getValue().get(0).toId());
  }

  @Test
  @DisplayName("legacy run context still processes incoming lineage")
  void legacyContextProcessesIncomingLineage() {
    UUID fromId = UUID.randomUUID();
    UUID toId = UUID.randomUUID();
    EntityInterface to = mock(EntityInterface.class);
    when(to.getId()).thenReturn(toId);
    when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
        .thenReturn(List.of());
    when(relationshipDAO.findFromBatch(anyList(), anyInt(), any(Include.class)))
        .thenReturn(List.of(lineage(fromId, toId)));

    processor.processBatchRelationships("table", List.of(to));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<RdfRepository.LineageEdgeData>> captor =
        ArgumentCaptor.forClass(List.class);
    verify(rdfRepository).bulkAddLineage(captor.capture(), eq(RdfWriteMode.RECONCILE));
    assertEquals(1, captor.getValue().size());
  }

  @Test
  @DisplayName("lineage bulk failure falls back per edge and isolates a bad edge")
  void lineageFallbackIsolatesBadEdge() {
    UUID fromId = UUID.randomUUID();
    UUID goodTargetId = UUID.randomUUID();
    UUID badTargetId = UUID.randomUUID();
    EntityInterface source = mock(EntityInterface.class);
    when(source.getId()).thenReturn(fromId);
    when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
        .thenReturn(List.of(lineage(fromId, goodTargetId), lineage(fromId, badTargetId)));
    org.mockito.Mockito.doAnswer(
            invocation -> {
              List<RdfRepository.LineageEdgeData> edges = invocation.getArgument(0);
              if (edges.size() > 1) {
                throw new RuntimeException("bulk lineage rejected");
              }
              if (edges.get(0).toId().equals(badTargetId)) {
                throw new RuntimeException("bad lineage edge");
              }
              return null;
            })
        .when(rdfRepository)
        .bulkAddLineage(anyList(), eq(RdfWriteMode.RECONCILE));

    RdfBatchProcessor.RelationshipProcessingResult result =
        processor.processBatchRelationships("table", List.of(source));

    assertEquals(1, result.failureCount());
    assertTrue(result.lastError().contains(badTargetId.toString()));
    verify(rdfRepository, times(3)).bulkAddLineage(anyList(), eq(RdfWriteMode.RECONCILE));
  }

  @Test
  @DisplayName("lineage fallback stops when the RDF circuit breaker opens")
  void lineageFallbackStopsWhenCircuitBreakerOpens() {
    UUID fromId = UUID.randomUUID();
    UUID firstTargetId = UUID.randomUUID();
    UUID secondTargetId = UUID.randomUUID();
    EntityInterface source = mock(EntityInterface.class);
    when(source.getId()).thenReturn(fromId);
    when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
        .thenReturn(List.of(lineage(fromId, firstTargetId), lineage(fromId, secondTargetId)));
    org.mockito.Mockito.doAnswer(
            invocation -> {
              List<RdfRepository.LineageEdgeData> edges = invocation.getArgument(0);
              if (edges.size() > 1) {
                throw new RuntimeException("bulk lineage rejected");
              }
              throw new RdfStorageCircuitOpenException("bulkAddLineage");
            })
        .when(rdfRepository)
        .bulkAddLineage(anyList(), eq(RdfWriteMode.RECONCILE));

    RdfBatchProcessor.RelationshipProcessingResult result =
        processor.processBatchRelationships("table", List.of(source));

    assertEquals(2, result.failureCount());
    verify(rdfRepository, times(2)).bulkAddLineage(anyList(), eq(RdfWriteMode.RECONCILE));
  }

  private static EntityRelationshipObject lineage(UUID fromId, UUID toId) {
    return EntityRelationshipObject.builder()
        .fromId(fromId.toString())
        .toId(toId.toString())
        .fromEntity("table")
        .toEntity("table")
        .relation(Relationship.UPSTREAM.ordinal())
        .json("{\"sqlQuery\":\"SELECT 1\"}")
        .build();
  }
}
