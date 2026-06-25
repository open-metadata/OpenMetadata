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
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;

/**
 * Elasticsearch mirror of {@link OpenSearchBulkSinkColumnBackpressureTest}. Verifies the same
 * column-fan-out backpressure invariant for the Elasticsearch sink: {@code submitColumnIndexTask}
 * must block the partition reader once {@code MAX_INFLIGHT_COLUMN_TASKS} tasks are outstanding so a
 * wide-table reindex cannot pin an unbounded number of {@code Table} entities and exhaust the heap.
 *
 * <p>Removing the {@code columnTaskSemaphore.acquire()} (the fix) makes the producer race past the
 * cap, and this test then times out waiting for the in-flight ceiling — reproducing the unbounded
 * fan-out.
 */
class ElasticSearchBulkSinkColumnBackpressureTest {

  private SearchRepository searchRepository;

  @BeforeEach
  void setUp() {
    searchRepository = mock(SearchRepository.class);
    ElasticSearchClient searchClient = mock(ElasticSearchClient.class);
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

    try (MockedConstruction<ElasticSearchBulkSink.CustomBulkProcessor> ignored =
        mockConstruction(ElasticSearchBulkSink.CustomBulkProcessor.class)) {

      ElasticSearchBulkSink sink =
          new ElasticSearchBulkSink(searchRepository, 10, 2, 1_000L) {
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
          ElasticSearchBulkSink.class.getDeclaredMethod(
              "submitColumnIndexTask", EntityInterface.class, ReindexContext.class);
      submit.setAccessible(true);

      Thread producer = newProducer(sink, submit, taskCount, submitted);
      producer.setDaemon(true);
      producer.start();

      try {
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
      ElasticSearchBulkSink sink, Method submit, int taskCount, AtomicInteger submitted) {
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
    Field field = ElasticSearchBulkSink.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.getInt(null);
  }

  private int pendingColumnFuturesSize(ElasticSearchBulkSink sink) throws Exception {
    Field field = ElasticSearchBulkSink.class.getDeclaredField("pendingColumnFutures");
    field.setAccessible(true);
    return ((ConcurrentLinkedDeque<?>) field.get(sink)).size();
  }
}
