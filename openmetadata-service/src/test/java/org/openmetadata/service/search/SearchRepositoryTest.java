package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.ElasticSearchBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.OpenSearchBulkSink;

@ExtendWith(MockitoExtension.class)
class SearchRepositoryTest {

  @Mock private SearchRepository searchRepository;

  @BeforeEach
  void setUp() {
    // Create a real instance for testing the new methods
    searchRepository = mock(SearchRepository.class);

    // Enable calling real methods for the methods we want to test
    lenient().when(searchRepository.createBulkSink(10, 2, 1000000L)).thenCallRealMethod();
    lenient().when(searchRepository.isVectorEmbeddingEnabled()).thenCallRealMethod();
  }

  @Test
  void testCreateBulkSinkForElasticSearch() {
    // Mock SearchRepository to return ElasticSearch type
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    BulkSink bulkSink = searchRepository.createBulkSink(10, 2, 1000000L);

    assertNotNull(bulkSink);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink);
  }

  @Test
  void testCreateBulkSinkForOpenSearch() {
    // Mock SearchRepository to return OpenSearch type
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);

    BulkSink bulkSink = searchRepository.createBulkSink(10, 2, 1000000L);

    assertNotNull(bulkSink);
    assertInstanceOf(OpenSearchBulkSink.class, bulkSink);
  }

  @Test
  void testCreateBulkSinkWithDifferentParameters() {
    // Test with different parameter values
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    BulkSink bulkSink1 = searchRepository.createBulkSink(50, 5, 5000000L);
    assertNotNull(bulkSink1);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink1);

    BulkSink bulkSink2 = searchRepository.createBulkSink(100, 10, 10000000L);
    assertNotNull(bulkSink2);
    assertInstanceOf(ElasticSearchBulkSink.class, bulkSink2);
  }

  @Test
  void testIsVectorEmbeddingEnabled() {
    // Test default implementation returns false
    boolean result = searchRepository.isVectorEmbeddingEnabled();
    assertFalse(result);
  }

  @Test
  void testCreateBulkSinkParameterValidation() {
    lenient()
        .when(searchRepository.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);

    // Test with minimum values
    BulkSink bulkSink1 = searchRepository.createBulkSink(1, 1, 1L);
    assertNotNull(bulkSink1);

    // Test with large values
    BulkSink bulkSink2 = searchRepository.createBulkSink(1000, 100, 100000000L);
    assertNotNull(bulkSink2);
  }
}
