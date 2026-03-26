package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Set;
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

@ExtendWith(MockitoExtension.class)
class SearchIndexStatsTest {

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
  @DisplayName("BulkSink Stats Tests")
  class BulkSinkStatsTests {

    private ElasticSearchBulkSink elasticSearchBulkSink;

    @BeforeEach
    void setUp() {
      elasticSearchBulkSink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);
    }

    @Test
    @DisplayName("Initial stats should be zero")
    void testInitialStatsAreZero() {
      StepStats stats = elasticSearchBulkSink.getStats();
      assertNotNull(stats);
      assertEquals(0, stats.getTotalRecords());
      assertEquals(0, stats.getSuccessRecords());
      assertEquals(0, stats.getFailedRecords());
    }
  }

  @Nested
  @DisplayName("Retry Logic Tests")
  class RetryLogicTests {

    @Test
    @DisplayName("Should identify 'Request entity too large' as retryable error")
    void testRequestEntityTooLargeIsRetryable() throws Exception {
      ElasticSearchBulkSink sink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);

      ElasticSearchBulkSink.CustomBulkProcessor processor = getCustomBulkProcessor(sink);

      assertTrue(invokeIsPayloadTooLargeError(processor, "Request entity too large"));
      assertTrue(invokeIsPayloadTooLargeError(processor, "Content too long"));
      assertTrue(invokeIsPayloadTooLargeError(processor, "HTTP 413 error"));
    }
  }

  @Nested
  @DisplayName("SearchIndexExecutor Stats Tests")
  class ExecutorStatsTests {

    private SearchIndexExecutor executor;

    @BeforeEach
    void setUp() {
      executor = new SearchIndexExecutor(collectionDAO, searchRepository);
    }

    @Test
    @DisplayName("Stats initialization should set all values correctly")
    void testStatsInitialization() {
      Set<String> entities = Set.of("table", "dashboard");

      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(
              Map.of("table", mock(IndexMapping.class), "dashboard", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);

      assertNotNull(stats);
      assertNotNull(stats.getJobStats());
      assertNotNull(stats.getReaderStats());
      assertNotNull(stats.getSinkStats());
      assertNotNull(stats.getEntityStats());

      assertEquals(0, stats.getJobStats().getSuccessRecords());
      assertEquals(0, stats.getJobStats().getFailedRecords());
      assertEquals(0, stats.getReaderStats().getSuccessRecords());
      assertEquals(0, stats.getReaderStats().getFailedRecords());
      assertEquals(0, stats.getSinkStats().getSuccessRecords());
      assertEquals(0, stats.getSinkStats().getFailedRecords());
    }

    @Test
    @DisplayName("updateStats should correctly accumulate values")
    void testUpdateStatsAccumulation() {
      Set<String> entities = Set.of("table");

      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      StepStats batchStats = new StepStats().withSuccessRecords(5).withFailedRecords(2);
      executor.updateStats("table", batchStats);

      Stats updatedStats = executor.getStats().get();
      assertNotNull(updatedStats);

      StepStats entityStats = updatedStats.getEntityStats().getAdditionalProperties().get("table");
      assertNotNull(entityStats);
      assertEquals(5, entityStats.getSuccessRecords());
      assertEquals(2, entityStats.getFailedRecords());

      assertEquals(5, updatedStats.getJobStats().getSuccessRecords());
      assertEquals(2, updatedStats.getJobStats().getFailedRecords());
    }

    @Test
    @DisplayName("updateReaderStats should correctly track reader operations")
    void testUpdateReaderStats() {
      Set<String> entities = Set.of("table");

      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateReaderStats(10, 2, 0);

      Stats updatedStats = executor.getStats().get();
      assertNotNull(updatedStats);
      assertEquals(10, updatedStats.getReaderStats().getSuccessRecords());
      assertEquals(2, updatedStats.getReaderStats().getFailedRecords());

      executor.updateReaderStats(5, 1, 0);

      updatedStats = executor.getStats().get();
      assertEquals(15, updatedStats.getReaderStats().getSuccessRecords());
      assertEquals(3, updatedStats.getReaderStats().getFailedRecords());
    }

    @Test
    @DisplayName("updateSinkTotalSubmitted should correctly track submitted records")
    void testUpdateSinkTotalSubmitted() {
      Set<String> entities = Set.of("table");

      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateSinkTotalSubmitted(10);

      Stats updatedStats = executor.getStats().get();
      assertNotNull(updatedStats);
      assertEquals(10, updatedStats.getSinkStats().getTotalRecords());

      executor.updateSinkTotalSubmitted(5);

      updatedStats = executor.getStats().get();
      assertEquals(15, updatedStats.getSinkStats().getTotalRecords());
    }
  }

  @Nested
  @DisplayName("Backpressure Detection Tests")
  class BackpressureDetectionTests {

    @Test
    @DisplayName("Should detect payload-too-large errors as retryable backpressure")
    void testPayloadTooLargeDetectedAsBackpressure() throws Exception {
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          getCustomBulkProcessor(new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L));

      assertTrue(invokeShouldRetry(processor, 0, "Request entity too large"));
      assertTrue(invokeShouldRetry(processor, 0, "Content too long for bulk request"));
      assertTrue(invokeShouldRetry(processor, 0, "HTTP 413: Payload too large"));
    }

    @Test
    @DisplayName("Should detect rejected_execution_exception as backpressure error")
    void testRejectedExecutionDetectedAsBackpressure() throws Exception {
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          getCustomBulkProcessor(new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L));

      assertTrue(invokeShouldRetry(processor, 0, "rejected_execution_exception"));
      assertTrue(invokeShouldRetry(processor, 0, "circuit_breaking_exception"));
      assertTrue(invokeShouldRetry(processor, 0, "too_many_requests"));
    }

    @Test
    @DisplayName(
        "Should detect only known backpressure errors while treating null messages as retryable")
    void testNormalErrorsNotBackpressure() throws Exception {
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          getCustomBulkProcessor(new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L));

      assertFalse(invokeShouldRetry(processor, 0, "Index not found"));
      assertFalse(invokeShouldRetry(processor, 0, "Document parsing exception"));
      assertFalse(invokeShouldRetry(processor, 0, "Mapping error"));
      assertTrue(invokeShouldRetry(processor, 0, null));
    }

    @Test
    @DisplayName("Should identify payload too large error correctly")
    void testIsPayloadTooLargeError() throws Exception {
      ElasticSearchBulkSink.CustomBulkProcessor processor =
          getCustomBulkProcessor(new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L));

      assertTrue(invokeIsPayloadTooLargeError(processor, "Request entity too large"));
      assertTrue(invokeIsPayloadTooLargeError(processor, "Content too long"));
      assertTrue(invokeIsPayloadTooLargeError(processor, "error code: 413"));

      assertFalse(invokeIsPayloadTooLargeError(processor, "rejected_execution_exception"));
      assertFalse(invokeIsPayloadTooLargeError(processor, "timeout"));
      assertFalse(invokeIsPayloadTooLargeError(processor, null));
    }
  }

  @Nested
  @DisplayName("Stats Consistency Tests")
  class StatsConsistencyTests {

    private SearchIndexExecutor executor;

    @BeforeEach
    void setUp() {
      executor = new SearchIndexExecutor(collectionDAO, searchRepository);
    }

    @Test
    @DisplayName("Job stats should match sum of entity stats")
    void testJobStatsMatchEntityStats() {
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

      executor.updateStats("table", new StepStats().withSuccessRecords(10).withFailedRecords(2));
      executor.updateStats("dashboard", new StepStats().withSuccessRecords(5).withFailedRecords(1));
      executor.updateStats("pipeline", new StepStats().withSuccessRecords(8).withFailedRecords(3));

      Stats finalStats = executor.getStats().get();

      int expectedSuccess = 10 + 5 + 8;
      int expectedFailed = 2 + 1 + 3;

      assertEquals(expectedSuccess, finalStats.getJobStats().getSuccessRecords());
      assertEquals(expectedFailed, finalStats.getJobStats().getFailedRecords());
    }

    @Test
    @DisplayName("Multiple updates to same entity should accumulate correctly")
    void testMultipleUpdatesToSameEntity() {
      Set<String> entities = Set.of("table");

      lenient()
          .when(searchRepository.getEntityIndexMap())
          .thenReturn(Map.of("table", mock(IndexMapping.class)));

      Stats stats = executor.initializeTotalRecords(entities);
      executor.getStats().set(stats);

      executor.updateStats("table", new StepStats().withSuccessRecords(10).withFailedRecords(2));
      executor.updateStats("table", new StepStats().withSuccessRecords(5).withFailedRecords(1));
      executor.updateStats("table", new StepStats().withSuccessRecords(3).withFailedRecords(0));

      Stats finalStats = executor.getStats().get();
      StepStats tableStats = finalStats.getEntityStats().getAdditionalProperties().get("table");

      assertEquals(18, tableStats.getSuccessRecords());
      assertEquals(3, tableStats.getFailedRecords());

      assertEquals(18, finalStats.getJobStats().getSuccessRecords());
      assertEquals(3, finalStats.getJobStats().getFailedRecords());
    }

    @Test
    @DisplayName("Stats should handle null stats object gracefully")
    void testNullStatsHandling() {
      executor.updateStats("table", new StepStats().withSuccessRecords(10).withFailedRecords(2));
      executor.updateReaderStats(5, 1, 0);
      executor.updateSinkTotalSubmitted(10);
    }
  }

  private ElasticSearchBulkSink.CustomBulkProcessor getCustomBulkProcessor(
      ElasticSearchBulkSink sink) throws Exception {
    java.lang.reflect.Field field = ElasticSearchBulkSink.class.getDeclaredField("bulkProcessor");
    field.setAccessible(true);
    return (ElasticSearchBulkSink.CustomBulkProcessor) field.get(sink);
  }

  private boolean invokeShouldRetry(
      ElasticSearchBulkSink.CustomBulkProcessor processor, int attemptNumber, String errorMessage)
      throws Exception {
    Method method =
        ElasticSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
            "shouldRetry", int.class, Throwable.class);
    method.setAccessible(true);
    Throwable error =
        errorMessage == null ? new RuntimeException() : new RuntimeException(errorMessage);
    return (boolean) method.invoke(processor, attemptNumber, error);
  }

  private boolean invokeIsPayloadTooLargeError(
      ElasticSearchBulkSink.CustomBulkProcessor processor, String errorMessage) throws Exception {
    Method method =
        ElasticSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
            "isPayloadTooLargeError", Throwable.class);
    method.setAccessible(true);
    Throwable error =
        errorMessage == null ? new RuntimeException() : new RuntimeException(errorMessage);
    return (boolean) method.invoke(processor, error);
  }
}
