package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.lenient;

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
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.RestHighLevelClient;

@ExtendWith(MockitoExtension.class)
class OpenSearchBulkSinkSimpleTest {

  @Mock private SearchRepository searchRepository;
  @Mock private OpenSearchClient searchClient;
  @Mock private RestHighLevelClient restHighLevelClient;
  @Mock private IndexMapping indexMapping;

  private OpenSearchBulkSink openSearchBulkSink;

  @BeforeEach
  void setUp() {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient().when(searchClient.getClient()).thenReturn(restHighLevelClient);
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
