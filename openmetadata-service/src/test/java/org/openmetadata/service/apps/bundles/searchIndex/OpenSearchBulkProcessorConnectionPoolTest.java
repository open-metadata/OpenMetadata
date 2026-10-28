package org.openmetadata.service.apps.bundles.searchIndex;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

/**
 * Drives the real OpenSearch client and its HC5 connection pool against a slow node: the reindex
 * must get slower when the cluster does, never drop documents.
 */
class OpenSearchBulkProcessorConnectionPoolTest {
  private static final String INDEX = "query_search_index";

  @Test
  void slowClusterNeverMakesBulksWaitForAPooledConnection() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(5, 30_000, 10_000);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(1_200);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 5, 1), 10, breaker, retries(5, 100))) {
      run.index(9);

      assertTrue(run.processor().flushAndWait(60, TimeUnit.SECONDS));
      assertEquals(0, run.failed().get(), "no bulk may fail because the pool was busy");
      assertEquals(9, run.succeeded().get());
      assertEquals(9, cluster.indexedDocuments());
      assertTrue(
          cluster.maxConcurrentBulks() <= 3,
          "a 5-connection pool leaves 2 for searches, so at most 3 bulks may be in flight");
      assertEquals(BulkCircuitBreaker.State.CLOSED, breaker.getState());
    }
  }

  @Test
  void openCircuitPausesBulksUntilTheClusterRecovers() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(2, 30_000, 200);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(50);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 20, 5), 4, breaker, retries(5, 50))) {
      cluster.rejectNextBulks(4);
      run.index(8);

      assertTrue(run.processor().flushAndWait(30, TimeUnit.SECONDS));
      assertEquals(4, cluster.rejectedBulks(), "four 429s are enough to open the circuit");
      assertEquals(0, run.failed().get(), "an open circuit must pause bulks, not drop them");
      assertEquals(8, run.succeeded().get());
      assertEquals(8, cluster.indexedDocuments());
      assertEquals(BulkCircuitBreaker.State.CLOSED, breaker.getState());
    }
  }

  @Test
  void circuitThatStaysOpenFailsItsBulksOnceTheirDeadlinePasses() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(2, 30_000, 100);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(20);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 20, 5),
                3,
                breaker,
                new BulkRetryPolicy(1, 50, 1_000, 500))) {
      cluster.rejectNextBulks(Integer.MAX_VALUE);
      run.index(3);

      assertTrue(run.processor().flushAndWait(30, TimeUnit.SECONDS));
      assertEquals(3, run.failed().get(), "a cluster that never recovers must still end the run");
      assertEquals(0, cluster.indexedDocuments());
    }
  }

  @Test
  void closingWhileBulksArePausedRecordsThemAsFailedInsteadOfLosingThem() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(1, 30_000, 300);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(20);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 20, 5), 2, breaker, retries(5, 50))) {
      cluster.rejectNextBulks(Integer.MAX_VALUE);
      run.index(2);
      await()
          .atMost(Duration.ofSeconds(5))
          .until(() -> breaker.getState() != BulkCircuitBreaker.State.CLOSED);

      assertFalse(run.processor().awaitClose(1, TimeUnit.SECONDS));
      await()
          .atMost(Duration.ofSeconds(10))
          .untilAsserted(() -> assertEquals(2, run.failed().get()));
    }
  }

  @Test
  void aFlushWaitingForPermitsDoesNotStopPausedBulksFromResuming() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(1, 30_000, 600);
    BulkProcessorSettings settings =
        new BulkProcessorSettings(2, 1_048_576L, 2, 500L, retries(5, 50));
    try (FakeSearchCluster cluster = FakeSearchCluster.start(50);
        ProcessorRun run =
            ProcessorRun.start(cluster.configuration(searchType(), 20, 5), settings, breaker)) {
      cluster.rejectNextBulks(2);
      run.processor().setSemaphoreAcquireTimeoutSecondsForTesting(3);

      // Two full bulks are rejected and pause holding both send permits; the fifth document then
      // waits for a permit inside a flush while the periodic flush queues up behind it.
      run.index(5);

      assertTrue(run.processor().flushAndWait(30, TimeUnit.SECONDS));
      assertEquals(0, run.failed().get(), "paused bulks must resume while a flush waits");
      assertEquals(5, run.succeeded().get());
      assertEquals(5, cluster.indexedDocuments());
    }
  }

  @Test
  void aBackoffLongerThanTheBulksDeadlineFailsTheBulkInsteadOfParkingIt() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(100, 30_000, 100);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(20);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 20, 5),
                2,
                breaker,
                new BulkRetryPolicy(5, 10_000, 10_000, 500))) {
      cluster.rejectNextBulks(Integer.MAX_VALUE);
      run.index(2);

      assertTrue(
          run.processor().flushAndWait(5, TimeUnit.SECONDS),
          "a retry that would end after the bulk's deadline must not be scheduled");
      assertEquals(2, run.failed().get());
    }
  }

  @Test
  void aFailedProbeDoesNotGiveItsBulkAFreshPause() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(1, 30_000, 100);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(20);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 20, 5),
                1,
                breaker,
                new BulkRetryPolicy(1_000, 10, 10, 500))) {
      cluster.rejectNextBulks(Integer.MAX_VALUE);
      run.index(1);

      assertTrue(
          run.processor().flushAndWait(4, TimeUnit.SECONDS),
          "probes that keep failing must not keep the bulk alive past its deadline");
      assertEquals(1, run.failed().get());
    }
  }

  @Test
  void anInterruptedCloseStillShutsTheSchedulerDown() throws Exception {
    BulkCircuitBreaker breaker = new BulkCircuitBreaker(5, 30_000, 10_000);
    try (FakeSearchCluster cluster = FakeSearchCluster.start(2_000);
        ProcessorRun run =
            ProcessorRun.start(
                cluster.configuration(searchType(), 20, 5), 2, breaker, retries(5, 50))) {
      run.index(1);
      Thread closer = Thread.ofPlatform().start(() -> closeQuietly(run));
      await()
          .atMost(Duration.ofSeconds(5))
          .until(() -> closer.getState() == Thread.State.TIMED_WAITING);

      closer.interrupt();
      closer.join(5_000);

      assertTrue(run.scheduler().isShutdown(), "an interrupted close must not leak the scheduler");
    }
  }

  private static void closeQuietly(ProcessorRun run) {
    try {
      run.processor().awaitClose(30, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private static BulkRetryPolicy retries(int maxRetries, long initialBackoffMillis) {
    return new BulkRetryPolicy(maxRetries, initialBackoffMillis, 1_000L);
  }

  private static ElasticSearchConfiguration.SearchType searchType() {
    return ElasticSearchConfiguration.SearchType.OPENSEARCH;
  }

  private record ProcessorRun(
      OpenSearchBulkSink.CustomBulkProcessor processor,
      AtomicLong succeeded,
      AtomicLong failed,
      OpenSearchClient client)
      implements AutoCloseable {

    static ProcessorRun start(
        ElasticSearchConfiguration configuration,
        int concurrentRequests,
        BulkCircuitBreaker breaker,
        BulkRetryPolicy retryPolicy) {
      return start(
          configuration,
          new BulkProcessorSettings(1, 1_048_576L, concurrentRequests, 60_000L, retryPolicy),
          breaker);
    }

    static ProcessorRun start(
        ElasticSearchConfiguration configuration,
        BulkProcessorSettings settings,
        BulkCircuitBreaker breaker) {
      AtomicLong succeeded = new AtomicLong();
      AtomicLong failed = new AtomicLong();
      OpenSearchClient client = new OpenSearchClient(configuration);
      OpenSearchBulkSink.CustomBulkProcessor processor =
          new OpenSearchBulkSink.CustomBulkProcessor(
              client,
              settings,
              new BulkProcessorCounters(
                  new AtomicLong(), succeeded, failed, new AtomicLong(), () -> {}),
              breaker);
      return new ProcessorRun(processor, succeeded, failed, client);
    }

    ScheduledExecutorService scheduler() throws ReflectiveOperationException {
      Field field = processor.getClass().getDeclaredField("scheduler");
      field.setAccessible(true);
      return (ScheduledExecutorService) field.get(processor);
    }

    void index(int documents) {
      for (int i = 0; i < documents; i++) {
        String docId = "query-" + i;
        processor.add(
            BulkOperation.of(
                op -> op.index(idx -> idx.index(INDEX).id(docId).document(Map.of("id", docId)))));
      }
    }

    @Override
    public void close() throws InterruptedException {
      try {
        processor.awaitClose(10, TimeUnit.SECONDS);
      } finally {
        client.close();
      }
    }
  }
}
