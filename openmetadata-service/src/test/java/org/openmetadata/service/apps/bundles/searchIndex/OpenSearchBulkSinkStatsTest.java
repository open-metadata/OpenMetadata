package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

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
    lenient()
        .when(searchClient.getBulkConnectionBudget())
        .thenReturn(BulkConnectionBudget.forPoolCapacity(1_000));
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
}
