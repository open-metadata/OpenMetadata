package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@ExtendWith(MockitoExtension.class)
class SemanticSearchToolTest {

  private SemanticSearchTool semanticSearchTool;
  private Authorizer authorizer;
  private CatalogSecurityContext securityContext;
  private SearchRepository searchRepository;
  private OpenSearchVectorService vectorService;

  @BeforeEach
  void setUp() {
    semanticSearchTool = new SemanticSearchTool();
    authorizer = mock(Authorizer.class);
    securityContext = mock(CatalogSecurityContext.class);
    searchRepository = mock(SearchRepository.class);
    vectorService = mock(OpenSearchVectorService.class);

    Entity.setSearchRepository(searchRepository);
  }

  @Test
  void testMissingQueryReturnsError() throws Exception {
    Map<String, Object> params = new HashMap<>();

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
    assertEquals(0, result.get("returnedCount"));
    assertNotNull(result.get("error"));
    assertTrue(result.get("error").toString().contains("'query' parameter is required"));
  }

  @Test
  void testBlankQueryReturnsError() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "   ");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
    assertNotNull(result.get("error"));
  }

  @Test
  void testVectorEmbeddingDisabledReturnsError() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(false);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test query");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
    assertTrue(result.get("error").toString().contains("Semantic search is not enabled"));
  }

  @Test
  void testVectorServiceNotInitializedReturnsError() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(null);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test query");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
      assertTrue(result.get("error").toString().contains("not initialized"));
    }
  }

  @Test
  void testEmptyResultsResponse() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(15L, Collections.emptyList());

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test query");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals("test query", result.get("query"));
      assertEquals(15L, result.get("tookMillis"));
      assertEquals(0, result.get("totalFound"));
      assertEquals(0, result.get("returnedCount"));
      assertTrue(((List<?>) result.get("results")).isEmpty());
    }
  }

  @Test
  void testNullHitsResponse() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(5L, null);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test query");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
      assertEquals(0, result.get("returnedCount"));
    }
  }

  @Test
  void testSuccessfulSearchIncludesTotalFound() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    hits.add(createHit("table", "db.schema.users", "Users Table", 0.95));
    hits.add(createHit("table", "db.schema.orders", "Orders Table", 0.87));

    VectorSearchResponse response = new VectorSearchResponse(25L, hits);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "user data");
      params.put("size", 10);

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals("user data", result.get("query"));
      assertEquals(25L, result.get("tookMillis"));
      assertEquals(2, result.get("totalFound"));
      assertEquals(2, result.get("returnedCount"));

      List<?> results = (List<?>) result.get("results");
      assertEquals(2, results.size());
    }
  }

  @Test
  void testHitFieldsCleaned() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    Map<String, Object> hit = new HashMap<>();
    hit.put("entityType", "table");
    hit.put("fullyQualifiedName", "db.schema.users");
    hit.put("name", "users");
    hit.put("displayName", "Users");
    hit.put("serviceType", "BigQuery");
    hit.put("_score", 0.95);
    hit.put("text_to_embed", "A short description");
    hit.put("columns", List.of(Map.of("name", "id", "dataType", "INT")));
    hit.put("embedding", new float[] {0.1f, 0.2f});
    hit.put("fingerprint", "abc123");

    VectorSearchResponse response = new VectorSearchResponse(10L, List.of(hit));

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "users");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      List<?> results = (List<?>) result.get("results");
      @SuppressWarnings("unchecked")
      Map<String, Object> cleaned = (Map<String, Object>) results.get(0);

      assertEquals("table", cleaned.get("entityType"));
      assertEquals("db.schema.users", cleaned.get("fullyQualifiedName"));
      assertEquals("users", cleaned.get("name"));
      assertEquals("Users", cleaned.get("displayName"));
      assertEquals("BigQuery", cleaned.get("serviceType"));
      assertEquals("A short description", cleaned.get("description"));
      assertNotNull(cleaned.get("columns"));
      assertEquals(0.95, cleaned.get("similarityScore"));
      assertTrue(!cleaned.containsKey("_score"));
      assertTrue(!cleaned.containsKey("embedding"));
      assertTrue(!cleaned.containsKey("fingerprint"));
    }
  }

  @Test
  void testLongDescriptionIsTruncated() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    String longText = "x".repeat(600);
    Map<String, Object> hit = new HashMap<>();
    hit.put("fullyQualifiedName", "db.schema.table");
    hit.put("text_to_embed", longText);

    VectorSearchResponse response = new VectorSearchResponse(10L, List.of(hit));

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      List<?> results = (List<?>) result.get("results");
      @SuppressWarnings("unchecked")
      Map<String, Object> cleaned = (Map<String, Object>) results.get(0);
      String truncated = (String) cleaned.get("description");

      assertEquals(453, truncated.length());
      assertTrue(truncated.endsWith("..."));
    }
  }

  @Test
  void testSizeClampedToMax() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(10L, Collections.emptyList());

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("size", 100);

      semanticSearchTool.execute(authorizer, securityContext, params);
    }
  }

  @Test
  void testMessageWhenResultsEqualRequestedSize() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      hits.add(createHit("table", "db.schema.t" + i, "Table " + i, 0.9 - i * 0.1));
    }

    VectorSearchResponse response = new VectorSearchResponse(10L, hits);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("size", 3);

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result.get("message"));
      assertTrue(result.get("message").toString().contains("Showing 3 results"));
    }
  }

  @Test
  void testNoMessageWhenResultsLessThanRequestedSize() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    hits.add(createHit("table", "db.schema.t1", "Table 1", 0.9));

    VectorSearchResponse response = new VectorSearchResponse(10L, hits);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("size", 10);

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertTrue(!result.containsKey("message"));
    }
  }

  @Test
  void testSearchExceptionReturnsError() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenThrow(new RuntimeException("Connection refused"));

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
      assertTrue(result.get("error").toString().contains("Connection refused"));
    }
  }

  @Test
  void testFiltersPassedAsMap() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(10L, Collections.emptyList());

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> filters = new HashMap<>();
      filters.put("entity_type", List.of("table", "topic"));
      filters.put("service", "my_db");

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("filters", filters);

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
    }
  }

  @Test
  void testStringParamsAreParsed() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(10L, Collections.emptyList());

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("size", "5");
      params.put("k", "500");
      params.put("threshold", "0.5");

      Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
    }
  }

  private Map<String, Object> createHit(String entityType, String fqn, String name, double score) {
    Map<String, Object> hit = new HashMap<>();
    hit.put("entityType", entityType);
    hit.put("fullyQualifiedName", fqn);
    hit.put("name", name);
    hit.put("_score", score);
    return hit;
  }
}
