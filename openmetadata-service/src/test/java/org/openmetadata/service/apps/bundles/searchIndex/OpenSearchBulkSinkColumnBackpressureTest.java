package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

/**
 * Regression test for the wide-table reindex OOM (a single partition of thousands of wide tables
 * exhausted the heap). Table column indexing must not fire an unbounded number of in-flight tasks
 * onto the shared doc-build pool, because each queued task retains its full {@code Table} until it
 * runs. The fix gates {@code submitColumnIndexTask} with a semaphore so the partition reader blocks
 * once {@code MAX_INFLIGHT_COLUMN_TASKS} tasks are outstanding.
 *
 * <p>With the fix: submitting many column tasks whose work is blocked stalls the producer after
 * exactly {@code MAX_INFLIGHT_COLUMN_TASKS} submissions, and {@code pendingColumnFutures} never
 * exceeds that cap. Without the fix (remove the {@code columnTaskSemaphore.acquire()}), the producer
 * races to submit every task with no backpressure and this test times out waiting for the cap —
 * i.e. it reproduces the unbounded fan-out that caused the OOM.
 */
class OpenSearchBulkSinkColumnBackpressureTest {

  private SearchRepository searchRepository;

  @BeforeEach
  void setUp() {
    searchRepository = mock(SearchRepository.class);
    OpenSearchClient searchClient = mock(OpenSearchClient.class);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getClusterAlias()).thenReturn("cluster");
  }

  @Test
  void columnIndexingAppliesBackpressureAtTheInFlightCap() throws Exception {
    int permits = readStaticInt("MAX_INFLIGHT_COLUMN_TASKS");
    int taskCount = permits + 64;

    CountDownLatch gate = new CountDownLatch(1);
    AtomicInteger started = new AtomicInteger(0);
    AtomicInteger submitted = new AtomicInteger(0);

    try (MockedConstruction<OpenSearchBulkSink.CustomBulkProcessor> ignored =
        mockConstruction(OpenSearchBulkSink.CustomBulkProcessor.class)) {

      OpenSearchBulkSink sink =
          new OpenSearchBulkSink(searchRepository, 10, 2, 1_000L) {
            @Override
            protected void indexTableColumns(
                EntityInterface entity, ReindexContext reindexContext) {
              started.incrementAndGet();
              try {
                gate.await(30, TimeUnit.SECONDS);
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
            }
          };

      Method submit =
          OpenSearchBulkSink.class.getDeclaredMethod(
              "submitColumnIndexTask", EntityInterface.class, ReindexContext.class);
      submit.setAccessible(true);

      Thread producer = newProducer(sink, submit, taskCount, submitted);
      producer.setDaemon(true);
      producer.start();

      try {
        // With the fix the producer can only push MAX_INFLIGHT_COLUMN_TASKS submissions through
        // before the next acquire() blocks; the semaphore makes this an exact, stable ceiling.
        Awaitility.await()
            .atMost(Duration.ofSeconds(15))
            .untilAsserted(() -> assertEquals(permits, submitted.get()));

        assertTrue(started.get() > 0, "blocked column tasks should have started executing");
        assertTrue(
            submitted.get() < taskCount,
            "producer must still be blocked on the semaphore, not have submitted every task");
        assertTrue(producer.isAlive(), "producer thread should be parked in acquire()");
        assertTrue(
            pendingColumnFuturesSize(sink) <= permits,
            "pendingColumnFutures must not exceed the in-flight cap");

        // Releasing the blocked tasks frees permits; the producer then drains the remainder.
        gate.countDown();
        Awaitility.await()
            .atMost(Duration.ofSeconds(15))
            .untilAsserted(() -> assertEquals(taskCount, submitted.get()));
      } finally {
        gate.countDown();
        producer.join(TimeUnit.SECONDS.toMillis(10));
      }

      assertFalse(producer.isAlive(), "producer should finish once permits are released");
    }
  }

  private Thread newProducer(
      OpenSearchBulkSink sink, Method submit, int taskCount, AtomicInteger submitted) {
    return new Thread(
        () -> {
          try {
            for (int i = 0; i < taskCount; i++) {
              submit.invoke(sink, tableEntity(i), null);
              submitted.incrementAndGet();
            }
          } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
          }
        },
        "column-submit-producer");
  }

  private EntityInterface tableEntity(int index) {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    when(entity.getName()).thenReturn("table-" + index);
    return entity;
  }

  private int readStaticInt(String fieldName) throws Exception {
    Field field = OpenSearchBulkSink.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.getInt(null);
  }

  private int pendingColumnFuturesSize(OpenSearchBulkSink sink) throws Exception {
    Field field = OpenSearchBulkSink.class.getDeclaredField("pendingColumnFutures");
    field.setAccessible(true);
    return ((ConcurrentLinkedDeque<?>) field.get(sink)).size();
  }
}
