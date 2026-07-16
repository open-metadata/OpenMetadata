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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_FAILED;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.CollectionDAO;
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
}
