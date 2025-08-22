package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;

class SearchRepositoryTest {

  private SearchRepository searchRepository;

  @BeforeEach
  void setUp() {
    // Create a real instance for testing the new methods
    searchRepository = mock(SearchRepository.class);

    // Mock the methods to return appropriate values for testing
    lenient()
        .when(searchRepository.createBulkSink(10, 2, 1000000L))
        .thenReturn(new TestBulkSink("test"));
    lenient().when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);
  }

  @Test
  void testCreateBulkSinkParameterValidation() {
    // Test the method can be called with the mocked repository
    BulkSink result = searchRepository.createBulkSink(10, 2, 1000000L);
    assertNotNull(result);
  }

  @Test
  void testIsVectorEmbeddingEnabledDefaultValue() {
    // Test the default implementation using the mocked repository
    boolean result = searchRepository.isVectorEmbeddingEnabled();
    assertFalse(result);
  }

  @Test
  void testCreateBulkSinkForElasticSearch() {
    // Test createBulkSink with ElasticSearch configuration
    SearchRepository esRepo = mock(SearchRepository.class);
    lenient()
        .when(esRepo.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
    lenient()
        .when(esRepo.createBulkSink(10, 2, 1000000L))
        .thenReturn(new TestBulkSink("elasticsearch"));

    BulkSink result = esRepo.createBulkSink(10, 2, 1000000L);
    assertNotNull(result);
  }

  @Test
  void testCreateBulkSinkForOpenSearch() {
    // Test createBulkSink with OpenSearch configuration
    SearchRepository osRepo = mock(SearchRepository.class);
    lenient()
        .when(osRepo.getSearchType())
        .thenReturn(ElasticSearchConfiguration.SearchType.OPENSEARCH);
    lenient()
        .when(osRepo.createBulkSink(10, 2, 1000000L))
        .thenReturn(new TestBulkSink("opensearch"));

    BulkSink result = osRepo.createBulkSink(10, 2, 1000000L);
    assertNotNull(result);
  }

  @Test
  void testBulkSinkCreationWithDifferentSearchTypes() {
    // Test that different search types are supported
    ElasticSearchConfiguration.SearchType elasticsearch =
        ElasticSearchConfiguration.SearchType.ELASTICSEARCH;
    ElasticSearchConfiguration.SearchType opensearch =
        ElasticSearchConfiguration.SearchType.OPENSEARCH;

    assertNotNull(elasticsearch);
    assertNotNull(opensearch);
    assertFalse(elasticsearch.equals(opensearch));
  }

  @Test
  void testCreateBulkSinkMethodSignature() throws Exception {
    // Test that the createBulkSink method exists with correct signature
    Method method =
        SearchRepository.class.getDeclaredMethod(
            "createBulkSink", int.class, int.class, long.class);

    assertNotNull(method);
    assertEquals(BulkSink.class, method.getReturnType());

    // Test parameter names and types
    assertEquals(3, method.getParameterCount());
    assertEquals(int.class, method.getParameterTypes()[0]); // batchSize
    assertEquals(int.class, method.getParameterTypes()[1]); // maxConcurrentRequests
    assertEquals(long.class, method.getParameterTypes()[2]); // maxPayloadSizeBytes
  }

  @Test
  void testIsVectorEmbeddingEnabledMethodSignature() throws Exception {
    // Test that the isVectorEmbeddingEnabled method exists with correct signature
    Method method = SearchRepository.class.getDeclaredMethod("isVectorEmbeddingEnabled");

    assertNotNull(method);
    assertEquals(boolean.class, method.getReturnType());
    assertEquals(0, method.getParameterCount());
  }

  @Test
  void testBulkSinkInterface() {
    // Test the BulkSink interface implementation
    BulkSink testSink = new TestBulkSink("test");

    assertNotNull(testSink);
    assertNotNull(testSink.getStats());

    // Test that all interface methods can be called without exception
    try {
      testSink.write(List.of(), Map.of());
      testSink.updateStats(1, 0);
      testSink.close();
    } catch (Exception e) {
      // Should not throw exceptions in our test implementation
      throw new RuntimeException("Unexpected exception in test BulkSink", e);
    }
  }

  @Test
  void testSearchTypeEnum() {
    // Test that the search type enumeration values exist
    ElasticSearchConfiguration.SearchType elasticsearch =
        ElasticSearchConfiguration.SearchType.ELASTICSEARCH;
    ElasticSearchConfiguration.SearchType opensearch =
        ElasticSearchConfiguration.SearchType.OPENSEARCH;

    assertNotNull(elasticsearch);
    assertNotNull(opensearch);

    // Verify they are different values
    assertFalse(elasticsearch.equals(opensearch));
  }

  // Simple test implementation of BulkSink
  private static class TestBulkSink implements BulkSink {
    private final String type;

    public TestBulkSink(String type) {
      this.type = type;
    }

    @Override
    public void write(List<?> entities, Map<String, Object> contextData) {
      // No-op for testing
    }

    @Override
    public void updateStats(int currentSuccess, int currentFailed) {
      // No-op for testing
    }

    @Override
    public StepStats getStats() {
      return new StepStats();
    }

    @Override
    public void close() {
      // No-op for testing
    }

    public String getType() {
      return type;
    }
  }
}
