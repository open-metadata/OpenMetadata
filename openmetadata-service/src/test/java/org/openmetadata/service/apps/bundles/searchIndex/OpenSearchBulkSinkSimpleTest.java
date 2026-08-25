package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

@ExtendWith(MockitoExtension.class)
class OpenSearchBulkSinkSimpleTest {

  @Mock private SearchRepository searchRepository;
  @Mock private OpenSearchClient searchClient;
  @Mock private os.org.opensearch.client.opensearch.OpenSearchClient restHighLevelClient;
  @Mock private IndexMapping indexMapping;

  private OpenSearchBulkSink openSearchBulkSink;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient().when(searchClient.getNewClient()).thenReturn(restHighLevelClient);
    lenient().when(searchRepository.getClusterAlias()).thenReturn("default");
    lenient().when(indexMapping.getIndexName("default")).thenReturn("test_index");
    lenient().when(searchRepository.getIndexMapping("table")).thenReturn(indexMapping);

    // Create the sink
    openSearchBulkSink = new OpenSearchBulkSink(searchRepository, 10, 2, 1000000L);
  }

  @Test
  void testSinkCreation() {
    assertNotNull(openSearchBulkSink);
    assertEquals(10, openSearchBulkSink.getBatchSize());
    assertEquals(2, openSearchBulkSink.getConcurrentRequests());
  }

  @Test
  void testGetStats() {
    StepStats stats = openSearchBulkSink.getStats();
    assertNotNull(stats);
    assertEquals(0, stats.getTotalRecords());
    assertEquals(0, stats.getSuccessRecords());
    assertEquals(0, stats.getFailedRecords());
  }

  @Test
  void testUpdateConfiguration() {
    openSearchBulkSink.updateBatchSize(20);
    assertEquals(20, openSearchBulkSink.getBatchSize());

    openSearchBulkSink.updateConcurrentRequests(5);
    assertEquals(5, openSearchBulkSink.getConcurrentRequests());
  }

  /**
   * Regression: when the bulk processor's concurrentRequestSemaphore is exhausted (e.g., a
   * leaked async future never released its permit), the bounded {@code tryAcquire} must record
   * the bulk as a permanent failure, leave {@code activeBulkRequests} at zero, and decrement the
   * pending-bulk-requests metric. Previously the unbounded {@code acquire()} would park the
   * caller forever and the entire pipeline froze at a fixed record count.
   */
  @Test
  void semaphoreTimeoutRecordsPermanentFailureWithoutIncrementingActiveRequests() throws Exception {
    OpenSearchBulkSink.CustomBulkProcessor processor = getCustomBulkProcessor(openSearchBulkSink);

    // Shorten the wait so the test doesn't sleep a minute. 0 = immediate fail-fast on no-permit.
    processor.setSemaphoreAcquireTimeoutSecondsForTesting(0L);

    // Drain the semaphore so flushInternal cannot acquire a permit. The sink was constructed
    // with concurrentRequests=2 (see setUp), so drain both.
    Semaphore semaphore = getField(processor, "concurrentRequestSemaphore", Semaphore.class);
    semaphore.acquire(2);
    int permitsBefore = semaphore.availablePermits();

    AtomicInteger activeBulkRequests =
        getField(processor, "activeBulkRequests", AtomicInteger.class);
    AtomicLong totalFailed = getField(openSearchBulkSink, "totalFailed", AtomicLong.class);
    long failedBefore = totalFailed.get();
    int activeBefore = activeBulkRequests.get();

    @SuppressWarnings("unchecked")
    List<BulkOperation> buffer = getField(processor, "buffer", List.class);
    buffer.add(mock(BulkOperation.class));

    Method flushInternal =
        OpenSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod("flushInternal");
    flushInternal.setAccessible(true);
    flushInternal.invoke(processor);

    // Permanent failure recorded — the 1 op we put in the buffer is now counted as failed.
    assertEquals(failedBefore + 1, totalFailed.get(), "totalFailed must increment on timeout");
    // Active bulk count must stay at the pre-flush value: we never entered the in-flight state.
    assertEquals(
        activeBefore,
        activeBulkRequests.get(),
        "activeBulkRequests must not increment when semaphore acquire times out");
    // Permits unchanged — the failed acquire path must NOT release a permit it never took.
    assertEquals(
        permitsBefore,
        semaphore.availablePermits(),
        "permits must not change when tryAcquire returns false");
    // Buffer drained — the failed batch shouldn't sit around to be re-flushed.
    assertTrue(buffer.isEmpty(), "buffer should be cleared after permanent failure");
  }

  @SuppressWarnings("unchecked")
  private static <T> T getField(Object target, String name, Class<T> type) throws Exception {
    Class<?> cls = target.getClass();
    while (cls != null) {
      try {
        Field f = cls.getDeclaredField(name);
        f.setAccessible(true);
        return (T) f.get(target);
      } catch (NoSuchFieldException e) {
        cls = cls.getSuperclass();
      }
    }
    throw new NoSuchFieldException(name);
  }

  private OpenSearchBulkSink.CustomBulkProcessor getCustomBulkProcessor(OpenSearchBulkSink sink)
      throws Exception {
    Field f = OpenSearchBulkSink.class.getDeclaredField("bulkProcessor");
    f.setAccessible(true);
    return (OpenSearchBulkSink.CustomBulkProcessor) f.get(sink);
  }

  @Test
  void testContextDataHandling() {
    Map<String, Object> contextData = new HashMap<>();
    contextData.put("entityType", "table");
    contextData.put("recreateIndex", true);

    Boolean recreateIndex = (Boolean) contextData.getOrDefault("recreateIndex", false);
    assertEquals(true, recreateIndex);

    contextData.put("recreateIndex", false);
    recreateIndex = (Boolean) contextData.getOrDefault("recreateIndex", false);
    assertEquals(false, recreateIndex);

    contextData.remove("recreateIndex");
    recreateIndex = (Boolean) contextData.getOrDefault("recreateIndex", false);
    assertEquals(false, recreateIndex);
  }
}
