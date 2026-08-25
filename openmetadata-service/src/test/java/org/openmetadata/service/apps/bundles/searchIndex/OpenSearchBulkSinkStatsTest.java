package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

import java.lang.reflect.Method;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

@ExtendWith(MockitoExtension.class)
class OpenSearchBulkSinkStatsTest {

  @Mock private SearchRepository searchRepository;
  @Mock private OpenSearchClient searchClient;
  @Mock private os.org.opensearch.client.opensearch.OpenSearchClient restClient;
  @Mock private IndexMapping indexMapping;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient().when(searchClient.getNewClient()).thenReturn(restClient);
    lenient().when(searchRepository.getClusterAlias()).thenReturn("default");
    lenient().when(indexMapping.getIndexName("default")).thenReturn("test_index");
    lenient().when(searchRepository.getIndexMapping(anyString())).thenReturn(indexMapping);
  }

  @Nested
  @DisplayName("OpenSearch BulkSink Stats Tests")
  class BulkSinkStatsTests {

    private OpenSearchBulkSink openSearchBulkSink;

    @BeforeEach
    void setUp() {
      openSearchBulkSink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000000L);
    }

    @Test
    @DisplayName("Initial stats should be zero")
    void testInitialStatsAreZero() {
      StepStats stats = openSearchBulkSink.getStats();
      assertNotNull(stats);
      assertEquals(0, stats.getTotalRecords());
      assertEquals(0, stats.getSuccessRecords());
      assertEquals(0, stats.getFailedRecords());
    }

    @Test
    @DisplayName("Batch size and concurrent requests should be configurable")
    void testConfiguration() {
      assertEquals(10, openSearchBulkSink.getBatchSize());
      assertEquals(2, openSearchBulkSink.getConcurrentRequests());

      openSearchBulkSink.updateBatchSize(20);
      assertEquals(20, openSearchBulkSink.getBatchSize());

      openSearchBulkSink.updateConcurrentRequests(5);
      assertEquals(5, openSearchBulkSink.getConcurrentRequests());
    }
  }

  @Nested
  @DisplayName("OpenSearch Retry Logic Tests")
  class RetryLogicTests {

    @Test
    @DisplayName("Should identify 'Request entity too large' as retryable error")
    void testRequestEntityTooLargeIsRetryable() throws Exception {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000000L);

      OpenSearchBulkSink.CustomBulkProcessor processor = getCustomBulkProcessor(sink);

      assertTrue(
          invokeIsPayloadTooLargeError(
              processor, new RuntimeException("Request entity too large")));
      assertTrue(invokeIsPayloadTooLargeError(processor, new RuntimeException("Content too long")));
      assertTrue(invokeIsPayloadTooLargeError(processor, new RuntimeException("HTTP 413 error")));
    }

    @Test
    @DisplayName("Should NOT identify normal errors as payload too large")
    void testNormalErrorsNotPayloadTooLarge() throws Exception {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000000L);

      OpenSearchBulkSink.CustomBulkProcessor processor = getCustomBulkProcessor(sink);

      assertFalse(
          invokeIsPayloadTooLargeError(processor, new RuntimeException("Connection timeout")));
      assertFalse(
          invokeIsPayloadTooLargeError(
              processor, new RuntimeException("rejected_execution_exception")));
      assertFalse(invokeIsPayloadTooLargeError(processor, new RuntimeException("Index not found")));
    }

    @Test
    @DisplayName("Should identify various retryable errors")
    void testRetryableErrors() throws Exception {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000000L);

      OpenSearchBulkSink.CustomBulkProcessor processor = getCustomBulkProcessor(sink);

      assertTrue(invokeShouldRetry(processor, 0, new RuntimeException("timeout")));
      assertTrue(
          invokeShouldRetry(processor, 0, new RuntimeException("rejected_execution_exception")));
      assertTrue(invokeShouldRetry(processor, 0, new RuntimeException("Request entity too large")));
      assertTrue(
          invokeShouldRetry(processor, 0, new RuntimeException("circuit_breaking_exception")));
      assertTrue(invokeShouldRetry(processor, 0, new RuntimeException("too_many_requests")));
    }

    @Test
    @DisplayName("Should not retry when max retries exceeded")
    void testMaxRetriesExceeded() throws Exception {
      OpenSearchBulkSink sink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000000L);

      OpenSearchBulkSink.CustomBulkProcessor processor = getCustomBulkProcessor(sink);

      assertFalse(invokeShouldRetry(processor, 10, new RuntimeException("timeout")));
    }

    private OpenSearchBulkSink.CustomBulkProcessor getCustomBulkProcessor(OpenSearchBulkSink sink)
        throws Exception {
      java.lang.reflect.Field field = OpenSearchBulkSink.class.getDeclaredField("bulkProcessor");
      field.setAccessible(true);
      return (OpenSearchBulkSink.CustomBulkProcessor) field.get(sink);
    }

    private boolean invokeIsPayloadTooLargeError(
        OpenSearchBulkSink.CustomBulkProcessor processor, Throwable error) throws Exception {
      Method method =
          OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
              "isPayloadTooLargeError", Throwable.class);
      method.setAccessible(true);
      return (boolean) method.invoke(processor, error);
    }

    private boolean invokeShouldRetry(
        OpenSearchBulkSink.CustomBulkProcessor processor, int attemptNumber, Throwable error)
        throws Exception {
      Method method =
          OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod(
              "shouldRetry", int.class, Throwable.class);
      method.setAccessible(true);
      return (boolean) method.invoke(processor, attemptNumber, error);
    }
  }
}
