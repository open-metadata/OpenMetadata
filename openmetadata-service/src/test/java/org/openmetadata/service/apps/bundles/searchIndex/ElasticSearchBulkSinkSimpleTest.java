package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
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
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;

@ExtendWith(MockitoExtension.class)
class ElasticSearchBulkSinkSimpleTest {

  @Mock private SearchRepository searchRepository;
  @Mock private ElasticSearchClient searchClient;
  @Mock private ElasticsearchClient restHighLevelClient;
  @Mock private IndexMapping indexMapping;

  private ElasticSearchBulkSink elasticSearchBulkSink;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient().when(searchClient.getNewClient()).thenReturn(restHighLevelClient);
    lenient().when(searchRepository.getClusterAlias()).thenReturn("default");
    lenient().when(indexMapping.getIndexName("default")).thenReturn("test_index");
    lenient().when(searchRepository.getIndexMapping("table")).thenReturn(indexMapping);

    elasticSearchBulkSink = new ElasticSearchBulkSink(searchRepository, 10, 2, 1000000L);
  }

  @Test
  void testSinkCreation() {
    assertNotNull(elasticSearchBulkSink);
    assertEquals(10, elasticSearchBulkSink.getBatchSize());
    assertEquals(2, elasticSearchBulkSink.getConcurrentRequests());
  }

  @Test
  void testGetStats() {
    StepStats stats = elasticSearchBulkSink.getStats();
    assertNotNull(stats);
    assertEquals(0, stats.getTotalRecords());
    assertEquals(0, stats.getSuccessRecords());
    assertEquals(0, stats.getFailedRecords());
  }

  @Test
  void testUpdateConfiguration() {
    elasticSearchBulkSink.updateBatchSize(20);
    assertEquals(20, elasticSearchBulkSink.getBatchSize());

    elasticSearchBulkSink.updateConcurrentRequests(5);
    assertEquals(5, elasticSearchBulkSink.getConcurrentRequests());
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

  /**
   * Mirror of {@code OpenSearchBulkSinkSimpleTest#semaphoreTimeoutRecordsPermanentFailure...}.
   * The Elasticsearch sink shares the leaked-future failure mode — without the bounded
   * tryAcquire, an exhausted semaphore parks every flush forever and the pipeline freezes at
   * a fixed record count. This test pins the same contract for ES: timed-out tryAcquire
   * records the bulk as a permanent failure, leaves activeBulkRequests at zero, and does NOT
   * release a permit it never took.
   */
  @Test
  void semaphoreTimeoutRecordsPermanentFailureWithoutIncrementingActiveRequests() throws Exception {
    ElasticSearchBulkSink.CustomBulkProcessor processor =
        getCustomBulkProcessor(elasticSearchBulkSink);

    processor.setSemaphoreAcquireTimeoutSecondsForTesting(0L);

    Semaphore semaphore = getField(processor, "concurrentRequestSemaphore", Semaphore.class);
    semaphore.acquire(2);
    int permitsBefore = semaphore.availablePermits();

    AtomicInteger activeBulkRequests =
        getField(processor, "activeBulkRequests", AtomicInteger.class);
    AtomicLong totalFailed = getField(elasticSearchBulkSink, "totalFailed", AtomicLong.class);
    long failedBefore = totalFailed.get();
    int activeBefore = activeBulkRequests.get();

    @SuppressWarnings("unchecked")
    List<BulkOperation> buffer = getField(processor, "buffer", List.class);
    buffer.add(mock(BulkOperation.class));

    Method flushInternal =
        ElasticSearchBulkSink.CustomBulkProcessor.class.getDeclaredMethod("flushInternal");
    flushInternal.setAccessible(true);
    flushInternal.invoke(processor);

    assertEquals(failedBefore + 1, totalFailed.get(), "totalFailed must increment on timeout");
    assertEquals(
        activeBefore,
        activeBulkRequests.get(),
        "activeBulkRequests must not increment when semaphore acquire times out");
    assertEquals(
        permitsBefore,
        semaphore.availablePermits(),
        "permits must not change when tryAcquire returns false");
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

  private ElasticSearchBulkSink.CustomBulkProcessor getCustomBulkProcessor(
      ElasticSearchBulkSink sink) throws Exception {
    Field f = ElasticSearchBulkSink.class.getDeclaredField("bulkProcessor");
    f.setAccessible(true);
    return (ElasticSearchBulkSink.CustomBulkProcessor) f.get(sink);
  }
}
