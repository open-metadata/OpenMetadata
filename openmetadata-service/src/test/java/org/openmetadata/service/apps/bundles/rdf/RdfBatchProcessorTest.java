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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException;

/**
 * Unit tests for {@link RdfBatchProcessor#processEntities}. Pins the three
 * branches of the bulk-write fast path that the prior reviews flagged as the
 * highest-complexity uncovered logic in the PR:
 *
 * <ol>
 *   <li>Bulk write succeeds → indexer reports all N entities indexed.</li>
 *   <li>Bulk write fails with a payload-shape error → per-entity fallback
 *       runs and isolates the bad row so other entities still land.</li>
 *   <li>Bulk write fails with a tripped circuit breaker → fallback is
 *       SKIPPED (every per-entity attempt would hit the same breaker); the
 *       whole batch is marked failed once, no per-entity calls.</li>
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
    // Bulk path took the write; per-entity createOrUpdate must NOT fire.
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities);
    verify(rdfRepository, never()).createOrUpdate(any(EntityInterface.class));
  }

  @Test
  @DisplayName(
      "bulk failure (non-breaker): per-entity fallback runs; bad row isolated, others succeed")
  void bulkFailurePerEntityFallbackIsolatesBadRow() {
    EntityInterface a = mockEntity();
    EntityInterface b = mockEntity();
    EntityInterface c = mockEntity();
    List<EntityInterface> entities = List.of(a, b, c);

    // First, the bulk path fails with a payload-shape error (a real
    // SerializationException-style failure, NOT the circuit breaker).
    doThrow(new RuntimeException("bad RDF model")).when(rdfRepository).bulkCreateOrUpdate(entities);

    // Then in the fallback loop, only entity b fails — a and c succeed.
    // Use lenient() because MockitoExtension's strict stubbing would
    // otherwise throw PotentialStubbingProblem on the createOrUpdate(a)
    // and createOrUpdate(c) calls (no matching stub for those arg values),
    // which the fallback's catch (Exception) block would treat as entity
    // failures and skew the success/failure counts.
    lenient()
        .doThrow(new RuntimeException("payload broken on b"))
        .when(rdfRepository)
        .createOrUpdate(b);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(2, result.successCount(), "a + c should succeed via per-entity fallback");
    assertEquals(1, result.failedCount(), "b should be the only failure");
    assertNotNull(result.lastError(), "lastError should carry b's failure");
    assertTrue(
        result.lastError().contains(b.getId().toString()),
        "lastError should include the failing entity's id");
    assertTrue(
        result.lastError().contains("payload broken on b"),
        "lastError should carry the underlying message");
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities);
    verify(rdfRepository, times(3)).createOrUpdate(any(EntityInterface.class));
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
        .bulkCreateOrUpdate(entities);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, null);

    assertEquals(0, result.successCount());
    assertEquals(3, result.failedCount(), "whole batch should be marked failed");
    assertNotNull(result.lastError());
    assertTrue(
        result.lastError().contains("table batch"),
        "lastError prefix should identify the failed entity-type batch");
    verify(rdfRepository, times(1)).bulkCreateOrUpdate(entities);
    // The critical assertion: NO per-entity calls were issued. Pre-fix the
    // implementation looped 3 times each hitting the same breaker.
    verify(rdfRepository, never()).createOrUpdate(any(EntityInterface.class));
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
    doThrow(wrapped).when(rdfRepository).bulkCreateOrUpdate(entities);

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("dashboard", entities, null);

    // Same as the unwrapped case: NO per-entity fallback.
    assertEquals(0, result.successCount());
    assertEquals(2, result.failedCount());
    verify(rdfRepository, never()).createOrUpdate(any(EntityInterface.class));
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
    verify(rdfRepository, never()).bulkCreateOrUpdate(anyList());
    verify(rdfRepository, never()).createOrUpdate(any(EntityInterface.class));
  }

  @Test
  @DisplayName("empty entity list short-circuits without touching the repository")
  void emptyEntityListShortCircuits() {
    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", List.of(), null);
    assertEquals(0, result.successCount());
    assertEquals(0, result.failedCount());
    verify(rdfRepository, never()).bulkCreateOrUpdate(anyList());
    verify(rdfRepository, never()).createOrUpdate(any(EntityInterface.class));
  }

  @Test
  @DisplayName(
      "bulk failure + stop signal raised mid-fallback: remaining per-entity attempts skipped")
  void stopSignalMidFallbackHonored() {
    EntityInterface a = mockEntity();
    EntityInterface b = mockEntity();
    EntityInterface c = mockEntity();
    List<EntityInterface> entities = List.of(a, b, c);

    doThrow(new RuntimeException("bad model")).when(rdfRepository).bulkCreateOrUpdate(entities);

    // Latch flips to true after the first per-entity attempt succeeds. The
    // loop must NOT call createOrUpdate for b or c after that.
    java.util.concurrent.atomic.AtomicBoolean stop =
        new java.util.concurrent.atomic.AtomicBoolean(false);
    org.mockito.Mockito.doAnswer(
            inv -> {
              stop.set(true);
              return null;
            })
        .when(rdfRepository)
        .createOrUpdate(eq(a));

    RdfBatchProcessor.BatchProcessingResult result =
        processor.processEntities("table", entities, stop::get);

    assertEquals(1, result.successCount(), "only a should have completed before stop");
    assertEquals(0, result.failedCount());
    verify(rdfRepository, atLeastOnce()).createOrUpdate(eq(a));
    verify(rdfRepository, never()).createOrUpdate(eq(b));
    verify(rdfRepository, never()).createOrUpdate(eq(c));
  }
}
