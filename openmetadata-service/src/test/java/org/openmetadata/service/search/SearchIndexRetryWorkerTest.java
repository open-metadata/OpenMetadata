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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_FAILED;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_IN_PROGRESS;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_1;
import static org.openmetadata.service.search.SearchIndexRetryQueue.STATUS_PENDING_RETRY_2;

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexRetryQueueDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchIndexRetryQueueDAO.SearchIndexRetryRecord;

class SearchIndexRetryWorkerTest {

  private final SearchIndexRetryWorker worker =
      new SearchIndexRetryWorker(mock(CollectionDAO.class), mock(SearchRepository.class));

  private static final long NOW = 1_800_000_000_000L;
  private static final long READ_AT = 1_700_000_000_000L;

  @Test
  void transientFailuresAreRetriedForAboutADayBeforeTheyAreDeadLettered() {
    assertEquals(STATUS_PENDING_RETRY_1, worker.retryableNextStatus(0));
    assertEquals(
        STATUS_PENDING_RETRY_2,
        worker.retryableNextStatus(2),
        "a third failure is retried later instead of being dead-lettered");
    assertEquals(
        STATUS_PENDING_RETRY_2,
        worker.retryableNextStatus(SearchIndexRetryWorker.RETRYABLE_ATTEMPTS - 2));
    assertEquals(
        STATUS_FAILED, worker.retryableNextStatus(SearchIndexRetryWorker.RETRYABLE_ATTEMPTS - 1));
    assertEquals(STATUS_FAILED, worker.retryableNextStatus(Integer.MAX_VALUE));
  }

  @Test
  void eachFailedAttemptWaitsLongerUpToAnHour() {
    assertEquals(Duration.ofSeconds(10).toMillis(), SearchIndexRetryWorker.retryDelayMillis(1));
    assertEquals(Duration.ofSeconds(20).toMillis(), SearchIndexRetryWorker.retryDelayMillis(2));
    assertEquals(Duration.ofHours(1).toMillis(), SearchIndexRetryWorker.retryDelayMillis(40));
    final long scheduled =
        IntStream.range(1, SearchIndexRetryWorker.RETRYABLE_ATTEMPTS)
            .mapToLong(SearchIndexRetryWorker::retryDelayMillis)
            .sum();
    assertTrue(scheduled >= Duration.ofHours(23).toMillis(), "retries span about a day");
  }

  @Test
  void aFailedAttemptIsScheduledAfterItsBackoff() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final SearchIndexRetryQueueDAO retryQueueDAO = mock(SearchIndexRetryQueueDAO.class);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    when(retryQueueDAO.updateFailureAndRetryCount(
            anyString(), anyString(), anyString(), anyString(), anyString(), anyLong()))
        .thenReturn(1);
    final SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(collectionDAO, mock(SearchRepository.class));
    final SearchIndexRetryRecord thirdAttempt =
        new SearchIndexRetryRecord(
            UUID.randomUUID().toString(),
            "service.database.table",
            "earlier failure",
            STATUS_IN_PROGRESS,
            "table",
            2,
            null,
            "claim-token");
    final long before = System.currentTimeMillis();

    retryWorker.recordRetryFailure(thirdAttempt, "still failing", STATUS_PENDING_RETRY_2);

    final ArgumentCaptor<Long> nextAttemptAt = ArgumentCaptor.forClass(Long.class);
    verify(retryQueueDAO)
        .updateFailureAndRetryCount(
            eq(thirdAttempt.getEntityId()),
            eq(thirdAttempt.getEntityFqn()),
            anyString(),
            eq(STATUS_PENDING_RETRY_2),
            eq("claim-token"),
            nextAttemptAt.capture());
    assertTrue(nextAttemptAt.getValue() >= before + SearchIndexRetryWorker.retryDelayMillis(3));
  }

  @Test
  void queueDepthIsPublishedForEachStatus() {
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final SearchIndexRetryQueueDAO retryQueueDAO = mock(SearchIndexRetryQueueDAO.class);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    when(retryQueueDAO.countByStatus(STATUS_PENDING)).thenReturn(3);
    when(retryQueueDAO.countByStatus(STATUS_FAILED)).thenReturn(2);
    final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    Metrics.addRegistry(registry);
    try {
      new SearchIndexRetryWorker(collectionDAO, mock(SearchRepository.class)).publishQueueDepth();

      assertEquals(3.0, queueDepth(registry, STATUS_PENDING));
      assertEquals(2.0, queueDepth(registry, STATUS_FAILED));
      assertEquals(0.0, queueDepth(registry, STATUS_PENDING_RETRY_2));
    } finally {
      Metrics.removeRegistry(registry);
    }
  }

  private static double queueDepth(final SimpleMeterRegistry registry, final String status) {
    return registry.get("search.retry.queue.depth").tag("status", status).gauge().value();
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
  void aMissingIndexATimeoutOrAConflictIsRetried() {
    assertTrue(worker.isRetryable(searchError(404)), "the index can be recreated");
    assertTrue(worker.isRetryable(searchError(408)), "the request timed out");
    assertTrue(worker.isRetryable(searchError(409)), "a concurrent write conflicted");
    assertFalse(worker.isRetryable(searchError(413)), "the document is too large to ever fit");
  }

  private static ElasticsearchException searchError(final int status) {
    final ElasticsearchException error = mock(ElasticsearchException.class);
    when(error.status()).thenReturn(status);
    return error;
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
    when(retryQueueDAO.findRetryCandidates(NOW, 5)).thenReturn(List.of(candidate));
    when(retryQueueDAO.claimRecord(eq(entityId), eq(entityFqn), eq(STATUS_PENDING), anyString()))
        .thenReturn(1);

    List<SearchIndexRetryRecord> claimed = retryQueueDAO.claimPending(1, NOW);

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
            eq(staleClaim.getEntityId()),
            eq(staleClaim.getEntityFqn()),
            eq("retry failed"),
            eq(STATUS_PENDING_RETRY_1),
            eq(staleClaim.getClaimToken()),
            anyLong()))
        .thenReturn(0);

    assertFalse(retryWorker.recordRetryFailure(staleClaim, "retry failed", STATUS_PENDING_RETRY_1));

    verify(retryQueueDAO)
        .updateFailureAndRetryCount(
            eq(staleClaim.getEntityId()),
            eq(staleClaim.getEntityFqn()),
            eq("retry failed"),
            eq(STATUS_PENDING_RETRY_1),
            eq("stale-claim-token"),
            anyLong());
  }

  @Test
  void transientEntityLoadFailureKeepsTheRetryClaim() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(collectionDAO, searchRepository);
    EntityReference root = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TOPIC);
    when(searchRepository.checkIfIndexingIsSupported(Entity.TOPIC)).thenReturn(true);
    when(searchRepository.getSearchIndexFactory()).thenReturn(new SearchIndexFactory());

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
  void successfulRetryReplaysDurablePropagationContext() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchIndexRetryWorker retryWorker =
        new SearchIndexRetryWorker(mock(CollectionDAO.class), searchRepository);
    EntityInterface<?> entity = mock(EntityInterface.class);
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
