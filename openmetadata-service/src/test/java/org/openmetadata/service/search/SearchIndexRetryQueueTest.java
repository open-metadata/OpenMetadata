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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class SearchIndexRetryQueueTest {

  private CollectionDAO collectionDAO;
  private CollectionDAO.SearchIndexRetryQueueDAO retryQueueDAO;

  @BeforeEach
  void setUp() throws Exception {
    retryQueueDAO = mock(CollectionDAO.SearchIndexRetryQueueDAO.class);
    collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    resetStaticState();
  }

  @AfterEach
  void tearDown() throws Exception {
    SearchIndexRetryQueue.stopFlusher(collectionDAO);
    resetStaticState();
  }

  // ---- enqueue ---------------------------------------------------------------

  @Test
  void enqueueAddsEntryToBufferWithoutCallingDao() throws Exception {
    SearchIndexRetryQueue.enqueue("id-1", "service.table", "table", "write failed");

    assertEquals(1, bufferSize());
    verifyNoInteractions(retryQueueDAO);
  }

  @Test
  void enqueueWithClientDownUsesSearchUnavailableStatus() throws Exception {
    SearchIndexRetryQueue.setSearchClientDown(true);

    SearchIndexRetryQueue.enqueue("id-1", "service.table", "table", "connection refused");

    SearchIndexRetryQueue.PendingEntry entry = peekBuffer();
    assertNotNull(entry);
    assertEquals(SearchIndexRetryQueue.STATUS_SEARCH_UNAVAILABLE, entry.status());
  }

  @Test
  void enqueueWithClientUpUsesPendingStatus() throws Exception {
    SearchIndexRetryQueue.setSearchClientDown(false);

    SearchIndexRetryQueue.enqueue("id-1", "service.table", "table", "mapping error");

    SearchIndexRetryQueue.PendingEntry entry = peekBuffer();
    assertNotNull(entry);
    assertEquals(SearchIndexRetryQueue.STATUS_PENDING, entry.status());
  }

  @Test
  void enqueueSkipsWhenBothIdAndFqnAreBlank() throws Exception {
    SearchIndexRetryQueue.enqueue(null, null, "table", "error");
    SearchIndexRetryQueue.enqueue("", "  ", "table", "error");
    SearchIndexRetryQueue.enqueue((String) null, null, "error");

    assertEquals(0, bufferSize());
  }

  @Test
  void enqueueSkipsNullEntity() throws Exception {
    SearchIndexRetryQueue.enqueue(
        (org.openmetadata.schema.EntityInterface) null, "index", new RuntimeException("fail"));

    assertEquals(0, bufferSize());
  }

  @Test
  void enqueueDropsEntryWhenBufferIsFull() throws Exception {
    fillBufferToCapacity();
    int sizeBefore = bufferSize();

    SearchIndexRetryQueue.enqueue("overflow-id", "overflow.fqn", "table", "overflow");

    assertEquals(sizeBefore, bufferSize());
  }

  @Test
  void enqueuePreservesAllFieldsInBuffer() throws Exception {
    SearchIndexRetryQueue.enqueue("id-1", "schema.table", "table", "write error");

    SearchIndexRetryQueue.PendingEntry entry = peekBuffer();
    assertNotNull(entry);
    assertEquals("id-1", entry.entityId());
    assertEquals("schema.table", entry.entityFqn());
    assertEquals("table", entry.entityType());
    assertEquals("write error", entry.failureReason());
  }

  @Test
  void enqueueNormalizesWhitespaceInIdAndFqn() throws Exception {
    SearchIndexRetryQueue.enqueue("  id-1  ", "  schema.table  ", "table", "error");

    SearchIndexRetryQueue.PendingEntry entry = peekBuffer();
    assertNotNull(entry);
    assertEquals("id-1", entry.entityId());
    assertEquals("schema.table", entry.entityFqn());
  }

  // ---- flushBuffer -----------------------------------------------------------

  @Test
  void flushBufferCallsBatchUpsertAndEmptiesBuffer() throws Exception {
    for (int i = 0; i < 10; i++) {
      SearchIndexRetryQueue.enqueue("id-" + i, "fqn-" + i, "table", "error");
    }

    SearchIndexRetryQueue.flushBuffer(collectionDAO);

    verify(retryQueueDAO, times(1)).batchUpsert(anyList());
    assertEquals(0, bufferSize());
  }

  @Test
  void flushBufferSplitsLargeBatchIntoMultipleUpserts() throws Exception {
    for (int i = 0; i < 70; i++) {
      SearchIndexRetryQueue.enqueue("id-" + i, "fqn-" + i, "table", "error");
    }

    SearchIndexRetryQueue.flushBuffer(collectionDAO);

    // 70 entries → batch of 50 + batch of 20 = 2 calls
    verify(retryQueueDAO, times(2)).batchUpsert(anyList());
    assertEquals(0, bufferSize());
  }

  @Test
  void flushBufferHandlesDaoExceptionWithoutThrowing() throws Exception {
    SearchIndexRetryQueue.enqueue("id-1", "fqn-1", "table", "error");
    doThrow(new RuntimeException("DB unavailable")).when(retryQueueDAO).batchUpsert(anyList());

    assertDoesNotThrow(() -> SearchIndexRetryQueue.flushBuffer(collectionDAO));
  }

  @Test
  void flushBufferDoesNothingWhenBufferIsEmpty() throws Exception {
    SearchIndexRetryQueue.flushBuffer(collectionDAO);

    verifyNoInteractions(retryQueueDAO);
  }

  // ---- startFlusher / stopFlusher --------------------------------------------

  @Test
  void startFlusherStartsDaemonThread() throws Exception {
    SearchIndexRetryQueue.startFlusher(collectionDAO);

    Thread flusherThread = getFlusherThread();
    assertNotNull(flusherThread);
    assertTrue(flusherThread.isAlive());
    assertTrue(flusherThread.isDaemon());
    assertEquals("search-retry-queue-flusher", flusherThread.getName());
  }

  @Test
  void startFlusherIsIdempotent() throws Exception {
    SearchIndexRetryQueue.startFlusher(collectionDAO);
    Thread firstThread = getFlusherThread();

    SearchIndexRetryQueue.startFlusher(collectionDAO);

    assertSame(firstThread, getFlusherThread());
  }

  @Test
  void stopFlusherPerformsFinalFlushOfRemainingEntries() throws Exception {
    SearchIndexRetryQueue.startFlusher(collectionDAO);
    for (int i = 0; i < 5; i++) {
      SearchIndexRetryQueue.enqueue("id-" + i, "fqn-" + i, "table", "error");
    }

    SearchIndexRetryQueue.stopFlusher(collectionDAO);

    verify(retryQueueDAO, atLeastOnce()).batchUpsert(anyList());
    assertEquals(0, bufferSize());
  }

  @Test
  void stopFlusherCanBeCalledWithoutPriorStart() {
    assertDoesNotThrow(() -> SearchIndexRetryQueue.stopFlusher(collectionDAO));
  }

  // ---- failureReason ---------------------------------------------------------

  @Test
  void failureReasonCombinesOperationAndExceptionMessage() {
    assertEquals(
        "index: connection timeout",
        SearchIndexRetryQueue.failureReason("index", new RuntimeException("connection timeout")));
  }

  @Test
  void failureReasonUsesClassNameWhenMessageIsNull() {
    assertEquals(
        "write: NullPointerException",
        SearchIndexRetryQueue.failureReason("write", new NullPointerException()));
  }

  @Test
  void failureReasonWithBlankOperationReturnsMessageOnly() {
    assertEquals(
        "disk full", SearchIndexRetryQueue.failureReason("", new RuntimeException("disk full")));
  }

  @Test
  void failureReasonWithNullThrowableReturnsUnknownFailure() {
    assertEquals("op: Unknown failure", SearchIndexRetryQueue.failureReason("op", null));
  }

  @Test
  void failureReasonTruncatesLongMessagesAt8192Chars() {
    String longMessage = "x".repeat(10_000);
    String reason = SearchIndexRetryQueue.failureReason("", new RuntimeException(longMessage));
    assertEquals(8192, reason.length());
  }

  // ---- isRetryableStatusCode -------------------------------------------------

  @Test
  void isRetryableStatusCodeTrueForServerAndRateLimitErrors() {
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(429));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(500));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(503));
  }

  @Test
  void isRetryableStatusCodeTrueForSuccessResponses() {
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(200));
    assertTrue(SearchIndexRetryQueue.isRetryableStatusCode(201));
  }

  @Test
  void isRetryableStatusCodeFalseForClientErrors() {
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(400));
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(404));
    assertFalse(SearchIndexRetryQueue.isRetryableStatusCode(422));
  }

  // ---- isUuid ----------------------------------------------------------------

  @Test
  void isUuidReturnsTrueForValidUuid() {
    assertTrue(SearchIndexRetryQueue.isUuid("123e4567-e89b-12d3-a456-426614174000"));
  }

  @Test
  void isUuidReturnsFalseForInvalidStrings() {
    assertFalse(SearchIndexRetryQueue.isUuid("not-a-uuid"));
    assertFalse(SearchIndexRetryQueue.isUuid("12345"));
  }

  // ---- normalize -------------------------------------------------------------

  @Test
  void normalizeTrimsWhitespace() {
    assertEquals("hello", SearchIndexRetryQueue.normalize("  hello  "));
  }

  @Test
  void normalizeReturnsEmptyStringForNull() {
    assertEquals("", SearchIndexRetryQueue.normalize(null));
  }

  @Test
  void normalizeReturnsEmptyStringForEmptyInput() {
    assertEquals("", SearchIndexRetryQueue.normalize(""));
  }

  // ---- suspension ------------------------------------------------------------

  @Test
  void updateSuspensionSuspendsSpecificEntityTypes() {
    SearchIndexRetryQueue.updateSuspension(Set.of("table", "dashboard"), false);

    assertTrue(SearchIndexRetryQueue.isEntityTypeSuspended("table"));
    assertTrue(SearchIndexRetryQueue.isEntityTypeSuspended("dashboard"));
    assertFalse(SearchIndexRetryQueue.isEntityTypeSuspended("pipeline"));
    assertTrue(SearchIndexRetryQueue.isStreamingSuspended());
    assertFalse(SearchIndexRetryQueue.isSuspendAllStreaming());
  }

  @Test
  void updateSuspensionWithSuspendAllSuspendsEveryEntityType() {
    SearchIndexRetryQueue.updateSuspension(Set.of(), true);

    assertTrue(SearchIndexRetryQueue.isEntityTypeSuspended("table"));
    assertTrue(SearchIndexRetryQueue.isEntityTypeSuspended("any-entity-type"));
    assertTrue(SearchIndexRetryQueue.isSuspendAllStreaming());
  }

  @Test
  void updateSuspensionWithNullEntityTypesHandlesGracefully() {
    SearchIndexRetryQueue.updateSuspension(null, false);

    assertFalse(SearchIndexRetryQueue.isStreamingSuspended());
  }

  @Test
  void clearSuspensionResetsAllFlags() {
    SearchIndexRetryQueue.updateSuspension(Set.of("table"), true);

    SearchIndexRetryQueue.clearSuspension();

    assertFalse(SearchIndexRetryQueue.isEntityTypeSuspended("table"));
    assertFalse(SearchIndexRetryQueue.isStreamingSuspended());
    assertFalse(SearchIndexRetryQueue.isSuspendAllStreaming());
    assertTrue(SearchIndexRetryQueue.getSuspendedEntityTypes().isEmpty());
  }

  @Test
  void isEntityTypeSuspendedReturnsFalseForBlankEntityType() {
    SearchIndexRetryQueue.updateSuspension(Set.of("table"), false);

    assertFalse(SearchIndexRetryQueue.isEntityTypeSuspended(""));
    assertFalse(SearchIndexRetryQueue.isEntityTypeSuspended(null));
  }

  // ---- status constants ------------------------------------------------------

  @Test
  void searchUnavailableStatusConstantHasCorrectValue() {
    assertEquals("SEARCH_UNAVAILABLE", SearchIndexRetryQueue.STATUS_SEARCH_UNAVAILABLE);
  }

  @Test
  void allStatusConstantsHaveCorrectValues() {
    assertEquals("PENDING", SearchIndexRetryQueue.STATUS_PENDING);
    assertEquals("PENDING_RETRY_1", SearchIndexRetryQueue.STATUS_PENDING_RETRY_1);
    assertEquals("PENDING_RETRY_2", SearchIndexRetryQueue.STATUS_PENDING_RETRY_2);
    assertEquals("IN_PROGRESS", SearchIndexRetryQueue.STATUS_IN_PROGRESS);
    assertEquals("COMPLETED", SearchIndexRetryQueue.STATUS_COMPLETED);
    assertEquals("FAILED", SearchIndexRetryQueue.STATUS_FAILED);
  }

  // ---- helpers ---------------------------------------------------------------

  @SuppressWarnings("unchecked")
  private ConcurrentLinkedQueue<SearchIndexRetryQueue.PendingEntry> getRawBuffer()
      throws Exception {
    Field f = SearchIndexRetryQueue.class.getDeclaredField("BUFFER");
    f.setAccessible(true);
    return (ConcurrentLinkedQueue<SearchIndexRetryQueue.PendingEntry>) f.get(null);
  }

  private int bufferSize() throws Exception {
    return getRawBuffer().size();
  }

  private SearchIndexRetryQueue.PendingEntry peekBuffer() throws Exception {
    return getRawBuffer().peek();
  }

  private Thread getFlusherThread() throws Exception {
    Field f = SearchIndexRetryQueue.class.getDeclaredField("FLUSHER_THREAD");
    f.setAccessible(true);
    return (Thread) f.get(null);
  }

  private void fillBufferToCapacity() {
    for (int i = 0; i < SearchIndexRetryQueue.BUFFER_MAX_SIZE; i++) {
      SearchIndexRetryQueue.enqueue("fill-" + i, "fqn-" + i, "table", "fill");
    }
  }

  @SuppressWarnings("unchecked")
  private void resetStaticState() throws Exception {
    Field bufferField = SearchIndexRetryQueue.class.getDeclaredField("BUFFER");
    bufferField.setAccessible(true);
    ((ConcurrentLinkedQueue<?>) bufferField.get(null)).clear();

    Field downField = SearchIndexRetryQueue.class.getDeclaredField("SEARCH_CLIENT_DOWN");
    downField.setAccessible(true);
    ((AtomicBoolean) downField.get(null)).set(false);

    Field suspendAllField = SearchIndexRetryQueue.class.getDeclaredField("SUSPEND_ALL_STREAMING");
    suspendAllField.setAccessible(true);
    ((AtomicBoolean) suspendAllField.get(null)).set(false);

    Field suspendedTypesField =
        SearchIndexRetryQueue.class.getDeclaredField("SUSPENDED_ENTITY_TYPES");
    suspendedTypesField.setAccessible(true);
    ((AtomicReference<Set<String>>) suspendedTypesField.get(null)).set(Collections.emptySet());

    Field runningField = SearchIndexRetryQueue.class.getDeclaredField("FLUSHER_RUNNING");
    runningField.setAccessible(true);
    runningField.setBoolean(null, false);

    Field threadField = SearchIndexRetryQueue.class.getDeclaredField("FLUSHER_THREAD");
    threadField.setAccessible(true);
    threadField.set(null, null);
  }
}
