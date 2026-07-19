/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_FAILED;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_IN_PROGRESS;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_1;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_2;

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexRetryQueueDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexRetryQueueDAO.SearchIndexRetryRecord;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

class SearchIndexRetryWorkerTest {

  private final SearchIndexRetryWorker worker =
      new SearchIndexRetryWorker(mock(CollectionDAO.class), mock(SearchRepository.class));

  @Test
  void retryableNextStatus_escalatesThenCapsAtFailed() {
    assertEquals(STATUS_PENDING_RETRY_1, worker.retryableNextStatus(0));
    assertEquals(
        STATUS_PENDING_RETRY_2,
        worker.retryableNextStatus(1),
        "the second failure schedules the final retry");
    assertEquals(
        STATUS_FAILED,
        worker.retryableNextStatus(2),
        "the third failure exhausts the three-attempt budget");
    assertEquals(STATUS_FAILED, worker.retryableNextStatus(Integer.MAX_VALUE));
  }

  @Test
  void isRetryable_transientAndUnknownRetry_fourXxDoesNot() {
    assertTrue(worker.isRetryable(new IOException("connection reset")), "network errors retry");
    assertTrue(
        worker.isRetryable(new RuntimeException("no status code")),
        "unknown errors default to retryable (conservative)");

    ElasticsearchException badRequest = mock(ElasticsearchException.class);
    when(badRequest.status()).thenReturn(400);
    assertFalse(worker.isRetryable(badRequest), "4xx is a permanent document error");

    ElasticsearchException serverError = mock(ElasticsearchException.class);
    when(serverError.status()).thenReturn(503);
    assertTrue(worker.isRetryable(serverError), "5xx is a transient cluster error");
  }

  @Test
  void claimPendingReturnsTheClaimTokenThatOwnsTheRow() {
    SearchIndexRetryQueueDAO retryQueueDAO =
        mock(SearchIndexRetryQueueDAO.class, CALLS_REAL_METHODS);
    String entityId = UUID.randomUUID().toString();
    String entityFqn = "service.database.table";
    SearchIndexRetryRecord candidate =
        new SearchIndexRetryRecord(
            entityId, entityFqn, "bulk failure", STATUS_PENDING, "table", 0, null);
    when(retryQueueDAO.findRetryCandidates(10, 20, 5)).thenReturn(List.of(candidate));
    when(retryQueueDAO.claimRecord(eq(entityId), eq(entityFqn), eq(STATUS_PENDING), anyString()))
        .thenReturn(1);

    List<SearchIndexRetryRecord> claimed = retryQueueDAO.claimPending(1, 10, 20);

    assertEquals(1, claimed.size());
    SearchIndexRetryRecord claimedRecord = claimed.getFirst();
    assertEquals(STATUS_IN_PROGRESS, claimedRecord.getStatus());
    assertNotNull(claimedRecord.getClaimToken());
    assertFalse(claimedRecord.getClaimToken().isBlank());
    verify(retryQueueDAO)
        .claimRecord(entityId, entityFqn, STATUS_PENDING, claimedRecord.getClaimToken());
  }

  @Test
  void completedStaleClaimDoesNotDeleteNewerQueueWork() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchIndexRetryQueueDAO retryQueueDAO = mock(SearchIndexRetryQueueDAO.class);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(collectionDAO, mock(SearchRepository.class));
    SearchIndexRetryRecord staleClaim = retryRecordWithClaimToken("stale-claim-token");
    when(retryQueueDAO.deleteClaimed(
            staleClaim.getEntityId(), staleClaim.getEntityFqn(), staleClaim.getClaimToken()))
        .thenReturn(0);

    assertFalse(retryWorker.completeClaim(staleClaim));

    verify(retryQueueDAO)
        .deleteClaimed(staleClaim.getEntityId(), staleClaim.getEntityFqn(), "stale-claim-token");
  }

  @Test
  void failedStaleClaimDoesNotOverwriteNewerQueueWork() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchIndexRetryQueueDAO retryQueueDAO = mock(SearchIndexRetryQueueDAO.class);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(collectionDAO, mock(SearchRepository.class));
    SearchIndexRetryRecord staleClaim = retryRecordWithClaimToken("stale-claim-token");
    when(retryQueueDAO.updateFailureAndRetryCount(
            staleClaim.getEntityId(),
            staleClaim.getEntityFqn(),
            "retry failed",
            STATUS_PENDING_RETRY_1,
            staleClaim.getClaimToken()))
        .thenReturn(0);

    assertFalse(retryWorker.recordRetryFailure(staleClaim, "retry failed", STATUS_PENDING_RETRY_1));

    verify(retryQueueDAO)
        .updateFailureAndRetryCount(
            staleClaim.getEntityId(),
            staleClaim.getEntityFqn(),
            "retry failed",
            STATUS_PENDING_RETRY_1,
            "stale-claim-token");
  }

  @Test
  void transientEntityLoadFailureKeepsTheRetryClaim() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(collectionDAO, searchRepository);
    EntityReference root = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TOPIC);
    when(searchRepository.checkIfIndexingIsSupported(Entity.TOPIC)).thenReturn(true);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(eq(root), anyString(), eq(Include.ALL)))
          .thenThrow(new RuntimeException("database unavailable"));

      RuntimeException failure =
          assertThrows(RuntimeException.class, () -> retryWorker.reindexEntityCascade(root));

      assertEquals("database unavailable", failure.getMessage());
    }
  }

  @Test
  void staleDeleteReachesCurrentAndStagedIndexes() throws Exception {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping indexMapping = mock(IndexMapping.class);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(collectionDAO, searchRepository);
    String entityId = UUID.randomUUID().toString();
    when(searchRepository.getIndexMapping(Entity.TOPIC)).thenReturn(indexMapping);
    when(searchRepository.getClusterAlias()).thenReturn("openmetadata");
    when(indexMapping.getIndexName("openmetadata")).thenReturn("openmetadata_topic_search_index");
    when(searchRepository.getWriteFanoutTargets("openmetadata_topic_search_index"))
        .thenReturn(List.of("openmetadata_topic_search_index", "topic_search_index_staged"));
    when(searchRepository.getSearchClient()).thenReturn(searchClient);

    retryWorker.removeStaleEntityById(entityId, Entity.TOPIC);

    verify(searchClient).deleteEntity("openmetadata_topic_search_index", entityId);
    verify(searchClient).deleteEntity("topic_search_index_staged", entityId);
  }

  @Test
  void testCaseRetryPreservesThenFencesRelationshipFields() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    BulkSink bulkSink = mock(BulkSink.class);
    when(searchRepository.createBulkSink(
            200, 5, SearchClusterMetrics.DEFAULT_BULK_PAYLOAD_SIZE_BYTES))
        .thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(mock(CollectionDAO.class), searchRepository);
    UUID testCaseId = UUID.randomUUID();
    EntityInterface testCase = mock(EntityInterface.class);
    when(testCase.getId()).thenReturn(testCaseId);
    when(testCase.getEntityReference())
        .thenReturn(
            new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE).withName("test"));
    Method upsertEntities =
        SearchIndexRetryWorker.class.getDeclaredMethod(
            "upsertEntitiesInBulk", List.class, Map.class);
    upsertEntities.setAccessible(true);

    try (MockedStatic<ReindexingUtil> reindexingUtil = mockStatic(ReindexingUtil.class)) {
      upsertEntities.invoke(retryWorker, List.of(testCase), Map.of(testCaseId, 17L));
    }

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(bulkSink, times(2)).write(eq(List.of(testCase)), contextCaptor.capture());
    Map<String, Object> documentContext = contextCaptor.getAllValues().get(0);
    Map<String, Object> relationshipContext = contextCaptor.getAllValues().get(1);
    assertEquals(
        Map.of(testCaseId, 17L), documentContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    assertFalse(documentContext.containsKey(BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));
    assertTrue((Boolean) relationshipContext.get(BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));
    assertEquals(
        Map.of(testCaseId, 17L),
        relationshipContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    verify(bulkSink).flushAndAwait(60);
    verify(bulkSink).close();
  }

  @Test
  void logicalTestSuiteRetryPreservesThenFencesRelationshipFields() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    BulkSink bulkSink = mock(BulkSink.class);
    when(searchRepository.createBulkSink(
            200, 5, SearchClusterMetrics.DEFAULT_BULK_PAYLOAD_SIZE_BYTES))
        .thenReturn(bulkSink);
    when(bulkSink.flushAndAwait(60)).thenReturn(true);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(mock(CollectionDAO.class), searchRepository);
    UUID testSuiteId = UUID.randomUUID();
    TestSuite testSuite = mock(TestSuite.class);
    when(testSuite.getId()).thenReturn(testSuiteId);
    when(testSuite.getBasic()).thenReturn(false);
    when(testSuite.getEntityReference())
        .thenReturn(
            new EntityReference()
                .withId(testSuiteId)
                .withType(Entity.TEST_SUITE)
                .withName("logicalSuite"));
    Method upsertEntities =
        SearchIndexRetryWorker.class.getDeclaredMethod(
            "upsertEntitiesInBulk", List.class, Map.class);
    upsertEntities.setAccessible(true);

    try (MockedStatic<ReindexingUtil> reindexingUtil = mockStatic(ReindexingUtil.class)) {
      upsertEntities.invoke(retryWorker, List.of(testSuite), Map.of(testSuiteId, 23L));
    }

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
    verify(bulkSink, times(2)).write(eq(List.of(testSuite)), contextCaptor.capture());
    Map<String, Object> documentContext = contextCaptor.getAllValues().get(0);
    Map<String, Object> relationshipContext = contextCaptor.getAllValues().get(1);
    assertEquals(Entity.TEST_SUITE, documentContext.get(ReindexingUtil.ENTITY_TYPE_KEY));
    assertEquals(
        Map.of(testSuiteId, 23L), documentContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    assertFalse(documentContext.containsKey(BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));
    assertTrue((Boolean) relationshipContext.get(BulkSink.SCRIPTED_PARTIAL_UPDATES_CONTEXT_KEY));
    assertEquals(
        Map.of(testSuiteId, 23L),
        relationshipContext.get(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY));
    verify(bulkSink).flushAndAwait(60);
    verify(bulkSink).close();
  }

  @Test
  void successfulRetryReplaysDurablePropagationContext() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(mock(CollectionDAO.class), searchRepository);
    EntityInterface entity = mock(EntityInterface.class);
    ChangeDescription changeDescription =
        new ChangeDescription()
            .withPreviousVersion(1.0)
            .withFieldsAdded(List.of())
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_DISPLAY_NAME)
                        .withOldValue("Old Service")
                        .withNewValue("New Service")))
            .withFieldsDeleted(List.of());
    String failureReason =
        SearchIndexRetryQueue.withPropagationContext("bulk flush timed out", changeDescription);

    retryWorker.propagateAfterRetry(entity, failureReason);

    ArgumentCaptor<ChangeDescription> changeCaptor =
        ArgumentCaptor.forClass(ChangeDescription.class);
    verify(searchRepository).propagateEntityAfterRetry(eq(entity), changeCaptor.capture());
    assertEquals(
        Entity.FIELD_DISPLAY_NAME, changeCaptor.getValue().getFieldsUpdated().getFirst().getName());
    assertEquals(
        "Old Service", changeCaptor.getValue().getFieldsUpdated().getFirst().getOldValue());
    assertEquals(
        "New Service", changeCaptor.getValue().getFieldsUpdated().getFirst().getNewValue());
  }

  private SearchIndexRetryRecord retryRecordWithClaimToken(String claimToken) {
    return new SearchIndexRetryRecord(
        UUID.randomUUID().toString(),
        "service.database.table",
        "original failure",
        STATUS_IN_PROGRESS,
        "table",
        0,
        null,
        claimToken);
  }
}
