package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.lenient;

import es.org.elasticsearch.client.RestHighLevelClient;
import java.util.HashMap;
import java.util.Map;
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
  @Mock private RestHighLevelClient restHighLevelClient;
  @Mock private IndexMapping indexMapping;

  private ElasticSearchBulkSink elasticSearchBulkSink;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient().when(searchClient.getClient()).thenReturn(restHighLevelClient);
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
  void testContextDataHandling()  {
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
