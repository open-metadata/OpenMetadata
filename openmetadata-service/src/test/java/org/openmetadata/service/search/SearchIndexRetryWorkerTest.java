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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;

class SearchIndexRetryWorkerTest {

  private CollectionDAO collectionDAO;
  private CollectionDAO.SearchIndexRetryQueueDAO retryQueueDAO;
  private SearchRepository searchRepository;
  private SearchClient searchClient;
  private SearchIndexRetryWorker worker;

  @BeforeEach
  void setUp() throws Exception {
    retryQueueDAO = mock(CollectionDAO.SearchIndexRetryQueueDAO.class);
    collectionDAO = mock(CollectionDAO.class);
    searchRepository = mock(SearchRepository.class);
    searchClient = mock(SearchClient.class);
    when(collectionDAO.searchIndexRetryQueueDAO()).thenReturn(retryQueueDAO);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    worker = new SearchIndexRetryWorker(collectionDAO, searchRepository);
    resetFlusherState();
  }

  @AfterEach
  void tearDown() throws Exception {
    SearchIndexRetryQueue.stopFlusher(collectionDAO);
    resetFlusherState();
  }

  // ---- PURGEABLE_QUEUE_STATUSES ----------------------------------------------

  @Test
  void purgeableQueueStatusesIncludesSearchUnavailable() throws Exception {
    Field field = SearchIndexRetryWorker.class.getDeclaredField("PURGEABLE_QUEUE_STATUSES");
    field.setAccessible(true);
    @SuppressWarnings("unchecked")
    List<String> statuses = (List<String>) field.get(null);

    assertTrue(statuses.contains(SearchIndexRetryQueue.STATUS_SEARCH_UNAVAILABLE));
  }

  @Test
  void purgeableQueueStatusesContainsAllExpectedStatuses() throws Exception {
    Field field = SearchIndexRetryWorker.class.getDeclaredField("PURGEABLE_QUEUE_STATUSES");
    field.setAccessible(true);
    @SuppressWarnings("unchecked")
    List<String> statuses = (List<String>) field.get(null);

    assertTrue(statuses.contains(SearchIndexRetryQueue.STATUS_PENDING));
    assertTrue(statuses.contains(SearchIndexRetryQueue.STATUS_PENDING_RETRY_1));
    assertTrue(statuses.contains(SearchIndexRetryQueue.STATUS_PENDING_RETRY_2));
    assertTrue(statuses.contains(SearchIndexRetryQueue.STATUS_FAILED));
    assertTrue(statuses.contains(SearchIndexRetryQueue.STATUS_SEARCH_UNAVAILABLE));
  }

  // ---- resetSearchUnavailableEntries -----------------------------------------

  @Test
  void resetSearchUnavailableEntriesCallsDao() throws Exception {
    when(retryQueueDAO.resetSearchUnavailableToPending()).thenReturn(5);

    invokeResetSearchUnavailableEntries();

    verify(retryQueueDAO).resetSearchUnavailableToPending();
  }

  @Test
  void resetSearchUnavailableEntriesHandlesZeroResets() throws Exception {
    when(retryQueueDAO.resetSearchUnavailableToPending()).thenReturn(0);

    assertDoesNotThrow(this::invokeResetSearchUnavailableEntries);
    verify(retryQueueDAO).resetSearchUnavailableToPending();
  }

  @Test
  void resetSearchUnavailableEntriesSwallowsDaoException() throws Exception {
    when(retryQueueDAO.resetSearchUnavailableToPending())
        .thenThrow(new RuntimeException("DB error"));

    assertDoesNotThrow(this::invokeResetSearchUnavailableEntries);
  }

  // ---- waitForClientAvailability availability transitions --------------------

  @Test
  void waitForClientAvailabilityResetsSearchUnavailableEntriesOnRecovery() throws Exception {
    // Search client was unavailable, now it's back up
    setWorkerField("searchClientWasAvailable", new AtomicBoolean(false));
    setWorkerField("consecutiveUnavailableCount", new AtomicInteger(3));
    when(searchClient.isClientAvailable()).thenReturn(true);
    when(retryQueueDAO.resetSearchUnavailableToPending()).thenReturn(5);

    boolean result = invokeWaitForClientAvailability(0);

    assertTrue(result);
    verify(retryQueueDAO).resetSearchUnavailableToPending();
  }

  @Test
  void waitForClientAvailabilityDoesNotResetWhenStillAvailable() throws Exception {
    // Search client was available and remains available — no reset needed
    setWorkerField("searchClientWasAvailable", new AtomicBoolean(true));
    when(searchClient.isClientAvailable()).thenReturn(true);

    boolean result = invokeWaitForClientAvailability(0);

    assertTrue(result);
    verify(retryQueueDAO, never()).resetSearchUnavailableToPending();
  }

  @Test
  void waitForClientAvailabilitySetsSearchClientDownFlagWhenUnavailable() throws Exception {
    // Prime the state: was available, but now client is down
    setWorkerField("searchClientWasAvailable", new AtomicBoolean(true));
    setWorkerField("consecutiveUnavailableCount", new AtomicInteger(0));

    // Make isClientAvailable return false but intercept the Thread.sleep by interrupting
    // the current thread after the call begins (skipped by testing state instead)
    when(searchClient.isClientAvailable()).thenReturn(false);

    // Run in a separate thread so we can interrupt the sleep
    Thread testThread =
        new Thread(
            () -> {
              try {
                invokeWaitForClientAvailability(0);
              } catch (Exception e) {
                Thread.currentThread().interrupt();
              }
            });
    testThread.setDaemon(true);
    testThread.start();
    // Give the method time to reach the sleep, then interrupt
    Thread.sleep(100);
    testThread.interrupt();
    testThread.join(2000);

    // After the method detects unavailability, SEARCH_CLIENT_DOWN should be set
    Field downField = SearchIndexRetryQueue.class.getDeclaredField("SEARCH_CLIENT_DOWN");
    downField.setAccessible(true);
    assertTrue(((AtomicBoolean) downField.get(null)).get());
  }

  // ---- helpers ---------------------------------------------------------------

  private void invokeResetSearchUnavailableEntries() throws Exception {
    Method method = SearchIndexRetryWorker.class.getDeclaredMethod("resetSearchUnavailableEntries");
    method.setAccessible(true);
    method.invoke(worker);
  }

  private boolean invokeWaitForClientAvailability(int workerId) throws Exception {
    Method method =
        SearchIndexRetryWorker.class.getDeclaredMethod("waitForClientAvailability", int.class);
    method.setAccessible(true);
    return (boolean) method.invoke(worker, workerId);
  }

  private void setWorkerField(String fieldName, Object value) throws Exception {
    Field field = SearchIndexRetryWorker.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(worker, value);
  }

  private void resetFlusherState() throws Exception {
    Field bufferField = SearchIndexRetryQueue.class.getDeclaredField("BUFFER");
    bufferField.setAccessible(true);
    ((ConcurrentLinkedQueue<?>) bufferField.get(null)).clear();

    Field downField = SearchIndexRetryQueue.class.getDeclaredField("SEARCH_CLIENT_DOWN");
    downField.setAccessible(true);
    ((AtomicBoolean) downField.get(null)).set(false);

    Field runningField = SearchIndexRetryQueue.class.getDeclaredField("FLUSHER_RUNNING");
    runningField.setAccessible(true);
    runningField.setBoolean(null, false);

    Field threadField = SearchIndexRetryQueue.class.getDeclaredField("FLUSHER_THREAD");
    threadField.setAccessible(true);
    threadField.set(null, null);
  }
}
