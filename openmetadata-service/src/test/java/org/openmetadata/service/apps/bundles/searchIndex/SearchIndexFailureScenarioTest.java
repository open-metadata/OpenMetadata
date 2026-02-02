package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;

/**
 * Comprehensive tests for SearchIndex stats accuracy across all failure scenarios:
 * 1. Request entity too large (413) from ES/OS
 * 2. Entity read failures
 * 3. Entity build failures
 * 4. Partial bulk failures
 * 5. Complete bulk request failures
 * 6. Reader exceptions
 * 7. Sink exceptions
 */
@ExtendWith(MockitoExtension.class)
class SearchIndexFailureScenarioTest {

  @Mock private SearchRepository searchRepository;
  @Mock private ElasticSearchClient searchClient;
  @Mock private ElasticsearchClient restHighLevelClient;
  @Mock private IndexMapping indexMapping;
  @Mock private CollectionDAO collectionDAO;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient().when(searchClient.getNewClient()).thenReturn(restHighLevelClient);
    lenient().when(searchRepository.getClusterAlias()).thenReturn("default");
    lenient().when(indexMapping.getIndexName("default")).thenReturn("test_index");
    lenient().when(searchRepository.getIndexMapping(anyString())).thenReturn(indexMapping);
  }

  @Nested
  @DisplayName("Scenario 1: Request Entity Too Large (413)")
  class RequestEntityTooLargeTests {

    @Test
    @DisplayName("Should detect 413 error as payload too large")
    void testDetect413Error() throws Exception {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Method method =
          SearchIndexExecutor.class.getDeclaredMethod("isPayloadTooLargeError", String.class);
      method.setAccessible(true);

      assertTrue((boolean) method.invoke(executor, "Request entity too large"));
      assertTrue((boolean) method.invoke(executor, "HTTP/1.1 413 Payload Too Large"));
      assertTrue((boolean) method.invoke(executor, "content too long"));
      assertTrue((boolean) method.invoke(executor, "Error code: 413"));
    }

    @Test
    @DisplayName("Should detect 413 error as backpressure trigger")
    void test413TriggersBackpressure() throws Exception {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Method method =
          SearchIndexExecutor.class.getDeclaredMethod("isBackpressureError", String.class);
      method.setAccessible(true);

      assertTrue((boolean) method.invoke(executor, "Request entity too large"));
      assertTrue((boolean) method.invoke(executor, "413"));
    }

    @Test
    @DisplayName("BulkSink should identify 413 as retryable error")
    void testBulkSinkRetries413() throws Exception {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);

      Field field = ElasticSearchBulkSink.class.getDeclaredField("bulkProcessor");
      field.setAccessible(true);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          (ElasticSearchBulkSink.CustomBulkProcessor) field.get(sink);

      Method method =
          ElasticSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
              "shouldRetry", int.class, Throwable.class);
      method.setAccessible(true);

      assertTrue(
          (boolean) method.invoke(processor, 0, new RuntimeException("Request entity too large")));
      assertTrue((boolean) method.invoke(processor, 0, new RuntimeException("Content too long")));
      assertTrue((boolean) method.invoke(processor, 0, new RuntimeException("413")));

      assertFalse(
          (boolean) method.invoke(processor, 5, new RuntimeException("Request entity too large")));
    }
  }

  @Nested
  @DisplayName("Scenario 2: Entity Read Failures")
  class EntityReadFailureTests {

    @Test
    @DisplayName("Reader failures should update reader stats")
    void testReaderFailuresUpdateStats() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateReaderStats(0, 10, 0);

      Stats updatedStats = executor.getStats().get();
      assertNotNull(updatedStats);
      assertEquals(0, updatedStats.getReaderStats().getSuccessRecords());
      assertEquals(10, updatedStats.getReaderStats().getFailedRecords());
    }

    @Test
    @DisplayName("Partial read failures should be tracked correctly")
    void testPartialReadFailures() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateReaderStats(90, 10, 0);
      executor.updateReaderStats(85, 15, 0);

      Stats updatedStats = executor.getStats().get();
      assertEquals(175, updatedStats.getReaderStats().getSuccessRecords());
      assertEquals(25, updatedStats.getReaderStats().getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Scenario 3: Entity Build Failures")
  class EntityBuildFailureTests {

    @Test
    @DisplayName("Process failures should be tracked in totalFailed")
    void testProcessFailuresTracked() throws Exception {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);

      // Failures during entity processing (building search docs) are tracked in totalFailed
      Field totalFailedField = ElasticSearchBulkSink.class.getDeclaredField("totalFailed");
      totalFailedField.setAccessible(true);
      AtomicLong totalFailed = (AtomicLong) totalFailedField.get(sink);
      totalFailed.set(5);

      Method updateStatsMethod = ElasticSearchBulkSink.class.getDeclaredMethod("updateStats");
      updateStatsMethod.setAccessible(true);
      updateStatsMethod.invoke(sink);

      StepStats stats = sink.getStats();
      assertEquals(5, stats.getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Scenario 4: Partial Bulk Failures")
  class PartialBulkFailureTests {

    @Test
    @DisplayName("Partial bulk failures should correctly split success and failure counts")
    void testPartialBulkFailureStats() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      StepStats batchStats = new StepStats().withSuccessRecords(8).withFailedRecords(2);
      executor.updateStats("table", batchStats);

      Stats finalStats = executor.getStats().get();
      StepStats entityStats = finalStats.getEntityStats().getAdditionalProperties().get("table");

      assertEquals(8, entityStats.getSuccessRecords());
      assertEquals(2, entityStats.getFailedRecords());
      assertEquals(8, finalStats.getJobStats().getSuccessRecords());
      assertEquals(2, finalStats.getJobStats().getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Scenario 5: Complete Bulk Request Failures")
  class CompleteBulkFailureTests {

    @Test
    @DisplayName("Complete bulk failure should mark all records as failed")
    void testCompleteBulkFailure() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      StepStats batchStats = new StepStats().withSuccessRecords(0).withFailedRecords(100);
      executor.updateStats("table", batchStats);

      Stats finalStats = executor.getStats().get();
      assertEquals(0, finalStats.getJobStats().getSuccessRecords());
      assertEquals(100, finalStats.getJobStats().getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Scenario 6: Stats Consistency")
  class StatsConsistencyTests {

    @Test
    @DisplayName("Total should equal success + failed after all operations")
    void testTotalEqualsSuccessPlusFailed() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table", "dashboard");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(
              Map.of("table", mock(IndexMapping.class), "dashboard", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      stats.getEntityStats().getAdditionalProperties().get("table").setTotalRecords(100);
      stats.getEntityStats().getAdditionalProperties().get("dashboard").setTotalRecords(50);
      stats.getJobStats().setTotalRecords(150);
      stats.getReaderStats().setTotalRecords(150);
      executor.getStats().set(stats);

      executor.updateStats("table", new StepStats().withSuccessRecords(90).withFailedRecords(10));
      executor.updateStats(
          "dashboard", new StepStats().withSuccessRecords(45).withFailedRecords(5));
      executor.updateReaderStats(135, 15, 0);

      Stats finalStats = executor.getStats().get();

      int jobSuccess = finalStats.getJobStats().getSuccessRecords();
      int jobFailed = finalStats.getJobStats().getFailedRecords();
      int jobTotal = finalStats.getJobStats().getTotalRecords();

      assertEquals(135, jobSuccess);
      assertEquals(15, jobFailed);
      assertEquals(jobSuccess + jobFailed, jobTotal);
    }

    @Test
    @DisplayName("Entity stats sum should equal job stats")
    void testEntityStatsSumEqualsJobStats() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table", "dashboard", "pipeline");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(
              Map.of(
                  "table", mock(IndexMapping.class),
                  "dashboard", mock(IndexMapping.class),
                  "pipeline", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateStats("table", new StepStats().withSuccessRecords(50).withFailedRecords(5));
      executor.updateStats(
          "dashboard", new StepStats().withSuccessRecords(30).withFailedRecords(3));
      executor.updateStats("pipeline", new StepStats().withSuccessRecords(20).withFailedRecords(2));

      Stats finalStats = executor.getStats().get();

      int entitySuccessSum = 0;
      int entityFailedSum = 0;
      for (StepStats entityStats : finalStats.getEntityStats().getAdditionalProperties().values()) {
        entitySuccessSum += entityStats.getSuccessRecords();
        entityFailedSum += entityStats.getFailedRecords();
      }

      assertEquals(entitySuccessSum, finalStats.getJobStats().getSuccessRecords());
      assertEquals(entityFailedSum, finalStats.getJobStats().getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Scenario 7: Error Type Detection")
  class ErrorTypeDetectionTests {

    @Test
    @DisplayName("Should correctly identify all retryable error types")
    void testAllRetryableErrorTypes() throws Exception {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);

      Field field = ElasticSearchBulkSink.class.getDeclaredField("bulkProcessor");
      field.setAccessible(true);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          (ElasticSearchBulkSink.CustomBulkProcessor) field.get(sink);

      Method method =
          ElasticSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
              "shouldRetry", int.class, Throwable.class);
      method.setAccessible(true);

      String[] retryableErrors = {
        "rejected_execution_exception",
        "EsRejectedExecutionException",
        "RemoteTransportException",
        "ConnectException",
        "timeout",
        "Request entity too large",
        "Content too long",
        "413",
        "circuit_breaking_exception",
        "too_many_requests"
      };

      for (String errorMessage : retryableErrors) {
        assertTrue(
            (boolean) method.invoke(processor, 0, new RuntimeException(errorMessage)),
            "Should retry for: " + errorMessage);
      }
    }

    @Test
    @DisplayName("Should NOT retry non-retryable errors")
    void testNonRetryableErrors() throws Exception {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);

      Field field = ElasticSearchBulkSink.class.getDeclaredField("bulkProcessor");
      field.setAccessible(true);
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          (ElasticSearchBulkSink.CustomBulkProcessor) field.get(sink);

      Method method =
          ElasticSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
              "shouldRetry", int.class, Throwable.class);
      method.setAccessible(true);

      String[] nonRetryableErrors = {
        "index_not_found_exception",
        "mapper_parsing_exception",
        "document_parsing_exception",
        "invalid_type_name_exception"
      };

      for (String errorMessage : nonRetryableErrors) {
        assertFalse(
            (boolean) method.invoke(processor, 0, new RuntimeException(errorMessage)),
            "Should NOT retry for: " + errorMessage);
      }
    }

    @Test
    @DisplayName("Should correctly identify backpressure errors")
    void testBackpressureErrorDetection() throws Exception {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Method method =
          SearchIndexExecutor.class.getDeclaredMethod("isBackpressureError", String.class);
      method.setAccessible(true);

      String[] backpressureErrors = {
        "rejected_execution_exception",
        "circuit_breaking_exception",
        "too_many_requests",
        "Request entity too large",
        "Content too long",
        "413"
      };

      for (String errorMessage : backpressureErrors) {
        assertTrue(
            (boolean) method.invoke(executor, errorMessage),
            "Should be backpressure for: " + errorMessage);
      }
    }
  }

  @Nested
  @DisplayName("Scenario 8: Multi-Batch Stats Accumulation")
  class MultiBatchStatsAccumulationTests {

    @Test
    @DisplayName("Stats should accumulate correctly across multiple batches")
    void testMultiBatchAccumulation() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      for (int i = 0; i < 10; i++) {
        executor.updateStats("table", new StepStats().withSuccessRecords(9).withFailedRecords(1));
        executor.updateReaderStats(10, 0, 0);
        executor.updateSinkTotalSubmitted(10);
      }

      Stats finalStats = executor.getStats().get();

      assertEquals(90, finalStats.getJobStats().getSuccessRecords());
      assertEquals(10, finalStats.getJobStats().getFailedRecords());
      assertEquals(100, finalStats.getReaderStats().getSuccessRecords());
      assertEquals(0, finalStats.getReaderStats().getFailedRecords());
      assertEquals(100, finalStats.getSinkStats().getTotalRecords());
    }

    @Test
    @DisplayName("Interleaved success and failure batches should accumulate correctly")
    void testInterleavedSuccessAndFailure() {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateStats("table", new StepStats().withSuccessRecords(100).withFailedRecords(0));
      executor.updateStats("table", new StepStats().withSuccessRecords(0).withFailedRecords(50));
      executor.updateStats("table", new StepStats().withSuccessRecords(75).withFailedRecords(25));

      Stats finalStats = executor.getStats().get();

      assertEquals(175, finalStats.getJobStats().getSuccessRecords());
      assertEquals(75, finalStats.getJobStats().getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Scenario 9: Concurrent Stats Updates")
  class ConcurrentStatsUpdateTests {

    @Test
    @DisplayName("Concurrent updates should not lose data")
    void testConcurrentUpdates() throws Exception {
      SearchIndexExecutor executor = new SearchIndexExecutor(collectionDAO, searchRepository);

      Set<String> entities = Set.of("table");
      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      int threadCount = 10;
      int updatesPerThread = 100;
      Thread[] threads = new Thread[threadCount];

      for (int i = 0; i < threadCount; i++) {
        threads[i] =
            new Thread(
                () -> {
                  for (int j = 0; j < updatesPerThread; j++) {
                    executor.updateStats(
                        "table", new StepStats().withSuccessRecords(1).withFailedRecords(0));
                  }
                });
      }

      for (Thread thread : threads) {
        thread.start();
      }

      for (Thread thread : threads) {
        thread.join();
      }

      Stats finalStats = executor.getStats().get();
      int expectedTotal = threadCount * updatesPerThread;

      assertEquals(expectedTotal, finalStats.getJobStats().getSuccessRecords());
    }
  }
}
