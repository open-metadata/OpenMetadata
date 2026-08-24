package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.util.PageCursor;
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
    lenient().when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
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
    when(searchRepository.getVectorIndexService()).thenReturn(null);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test query");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
    assertTrue(result.get("error").toString().contains("not initialized"));
  }

  @Test
  void testEmptyResultsResponse() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(15L, Collections.emptyList());

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
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

  @Test
  void testNullHitsResponse() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(5L, null);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test query");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
    assertEquals(0, result.get("returnedCount"));
  }

  @Test
  void testSuccessfulSearchIncludesTotalFound() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    hits.add(createHit("table", "db.schema.users", "Users Table", 0.95));
    hits.add(createHit("table", "db.schema.orders", "Orders Table", 0.87));

    VectorSearchResponse response = new VectorSearchResponse(25L, hits);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
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
    hit.put("description", "A short description");
    hit.put("columns", List.of(Map.of("name", "id", "dataType", "INT")));
    hit.put("embedding", new float[] {0.1f, 0.2f});
    hit.put("fingerprint", "abc123");
    hit.put(
        "textToLLMContext", "name: users; entityType: table | description: A short description");

    VectorSearchResponse response = new VectorSearchResponse(10L, List.of(hit));

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
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
    // Column *names* replace full column objects: on a live 10-hit response full `columns` was
    // 68.6% of the payload, and per-column descriptions do not help pick the right asset.
    assertNull(cleaned.get("columns"), "full column objects must not ship in a search hit");
    assertNotNull(cleaned.get("columnNames"), "column names are kept so the hit stays selectable");
    assertEquals(0.95, cleaned.get("similarityScore"));
    assertTrue(!cleaned.containsKey("_score"));
    assertTrue(!cleaned.containsKey("embedding"));
    assertTrue(!cleaned.containsKey("fingerprint"));
    assertTrue(!cleaned.containsKey("textToLLMContext"));
  }

  @Test
  void testLongDescriptionIsTruncated() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    String longText = "x".repeat(600);
    Map<String, Object> hit = new HashMap<>();
    hit.put("fullyQualifiedName", "db.schema.table");
    hit.put("description", longText);

    VectorSearchResponse response = new VectorSearchResponse(10L, List.of(hit));

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
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

  @Test
  void testSizeClampedToMax() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(10L, Collections.emptyList());

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 100);

    semanticSearchTool.execute(authorizer, securityContext, params);
  }

  @Test
  void testMessageWhenResultsEqualRequestedSize() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      hits.add(createHit("table", "db.schema.t" + i, "Table " + i, 0.9 - i * 0.1));
    }

    VectorSearchResponse response = new VectorSearchResponse(10L, hits, null, true);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 3);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result.get("message"));
    assertTrue(result.get("message").toString().contains("Showing 3 results"));
  }

  @Test
  void testNoMessageWhenResultsLessThanRequestedSize() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    hits.add(createHit("table", "db.schema.t1", "Table 1", 0.9));

    VectorSearchResponse response = new VectorSearchResponse(10L, hits);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 10);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertTrue(!result.containsKey("message"));
  }

  @Test
  void testSearchExceptionReturnsError() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenThrow(new RuntimeException("Connection refused"));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
    assertTrue(result.get("error").toString().contains("Connection refused"));
  }

  @Test
  void testTopLevelFilterIsRejectedInsteadOfIgnored() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "Active Customers");
    params.put("entityType", "metric");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    String error = (String) result.get("error");
    assertNotNull(error);
    assertTrue(error.contains("entityType"));
    assertTrue(error.contains("filters"));
    assertEquals(0, result.get("totalFound"));
    verify(vectorService, never())
        .search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble());
  }

  @Test
  void testCustomUnitReplacesTheOtherSentinelOnEntityIndexHits() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    // Entity-index hits carry the raw enum plus a separate custom unit; chunk docs carry the
    // resolved value. Both must look the same to the caller.
    Map<String, Object> hit = createHit("metric", "SpreadBps", "SpreadBps", 0.9);
    hit.put("unitOfMeasurement", "OTHER");
    hit.put("customUnitOfMeasurement", "basis points");

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(new VectorSearchResponse(10L, List.of(hit)));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "spread");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    @SuppressWarnings("unchecked")
    Map<String, Object> cleaned = (Map<String, Object>) ((List<?>) result.get("results")).get(0);
    assertEquals("basis points", cleaned.get("unitOfMeasurement"));
    assertFalse(cleaned.containsKey("customUnitOfMeasurement"));
  }

  @Test
  void testFiltersPassedAsMap() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(10L, Collections.emptyList());

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> filters = new HashMap<>();
    filters.put("entityType", List.of("table", "topic"));
    filters.put("service", "my_db");

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("filters", filters);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(0, result.get("totalFound"));
  }

  @Test
  void testStringParamsAreParsed() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    VectorSearchResponse response = new VectorSearchResponse(10L, Collections.emptyList());

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", "5");
    params.put("k", "500");
    params.put("threshold", "0.5");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
  }

  @Test
  void fullPageEmitsNextCursorAtRequestedOffset() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      hits.add(createHit("table", "db.schema.t" + i, "Table " + i, 0.9 - i * 0.1));
    }
    VectorSearchResponse response = new VectorSearchResponse(10L, hits, null, true);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 3);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertEquals(Boolean.TRUE, result.get("hasMore"));
    Optional<PageCursor.Cursor> decoded = PageCursor.decode((String) result.get("nextCursor"));
    assertTrue(decoded.isPresent());
    assertTrue(decoded.get().isOffset());
    assertEquals(3, decoded.get().offset());
  }

  @Test
  void cursorParamThreadsOffsetIntoVectorSearch() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    VectorSearchResponse response = new VectorSearchResponse(5L, Collections.emptyList());

    ArgumentCaptor<Integer> fromCaptor = ArgumentCaptor.forClass(Integer.class);
    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("cursor", PageCursor.encodeOffset(30));

    semanticSearchTool.execute(authorizer, securityContext, params);

    verify(vectorService)
        .search(anyString(), anyMap(), anyInt(), fromCaptor.capture(), anyInt(), anyDouble());
    assertEquals(30, fromCaptor.getValue());
  }

  @Test
  void fullLastPageWithKnownTotalDoesNotAdvertiseMore() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      hits.add(createHit("table", "db.schema.t" + i, "Table " + i, 0.9 - i * 0.1));
    }
    VectorSearchResponse response = new VectorSearchResponse(10L, hits, 3L, false);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 3);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNull(result.get("hasMore"));
    assertNull(result.get("nextCursor"));
  }

  @Test
  void fullPageWithNullTotalButHasMoreFalseDoesNotAdvertise() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      hits.add(createHit("table", "db.schema.t" + i, "Table " + i, 0.9 - i * 0.1));
    }
    VectorSearchResponse response = new VectorSearchResponse(10L, hits, null, false);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 3);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNull(result.get("hasMore"));
    assertNull(result.get("nextCursor"));
  }

  @Test
  void fullPageWithNoSignalDoesNotAdvertisePhantomPage() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      hits.add(createHit("table", "db.schema.t" + i, "Table " + i, 0.9 - i * 0.1));
    }
    VectorSearchResponse response = new VectorSearchResponse(10L, hits, null, null);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 3);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNull(result.get("hasMore"));
    assertNull(result.get("nextCursor"));
  }

  @Test
  void zeroReturnedAfterBudgetTrimDoesNotSelfLoop() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    List<Map<String, Object>> hits = new ArrayList<>();
    Map<String, Object> huge = createHit("table", "db.schema.huge", "Huge", 0.99);
    huge.put("description", "x".repeat(200_000));
    hits.add(huge);
    VectorSearchResponse response = new VectorSearchResponse(10L, hits, null, true);

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(response);

    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("size", 1);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    int returned = result.get("returnedCount") instanceof Number n ? n.intValue() : -1;
    if (returned == 0) {
      assertNull(result.get("nextCursor"), "cursor must not point back to the same page");
    }
  }

  @Test
  void testMetricFactsAreReturnedForShortlisting() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    Map<String, Object> hit = createHit("metric", "MonthlyActiveUsers", "MonthlyActiveUsers", 0.9);
    hit.put("metricExpression", Map.of("language", "SQL", "code", "SELECT COUNT(DISTINCT id)"));
    hit.put("metricType", "COUNT");
    hit.put("granularity", "MONTH");
    hit.put("unitOfMeasurement", "COUNT");
    hit.put("extension", Map.of("owningTeam", "growth"));

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(new VectorSearchResponse(10L, List.of(hit)));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "active customers");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    @SuppressWarnings("unchecked")
    Map<String, Object> cleaned = (Map<String, Object>) ((List<?>) result.get("results")).get(0);
    @SuppressWarnings("unchecked")
    Map<String, Object> expression = (Map<String, Object>) cleaned.get("metricExpression");
    assertEquals("SELECT COUNT(DISTINCT id)", expression.get("code"));
    assertEquals("MONTH", cleaned.get("granularity"));
    assertEquals("COUNT", cleaned.get("metricType"));
    assertEquals("COUNT", cleaned.get("unitOfMeasurement"));
    // Custom properties stay a get_entity_details concern: unbounded user JSON would compete with
    // results for the response budget.
    assertFalse(cleaned.containsKey("extension"));
  }

  @Test
  void testUnknownFilterKeyIsRejectedInsteadOfIgnored() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "active users");
    params.put("filters", Map.of("granularityy", List.of("MONTH")));

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    String error = (String) result.get("error");
    assertNotNull(error);
    assertTrue(error.contains("granularityy"));
    assertTrue(error.contains("granularity"), "the error lists the supported fields");
    verify(vectorService, never())
        .search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble());
  }

  @Test
  void testSupportedMetricFacetFilterIsAccepted() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(new VectorSearchResponse(10L, Collections.emptyList()));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "active users");
    params.put("filters", Map.of("granularity", List.of("MONTH"), "metricType", List.of("COUNT")));

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNull(result.get("error"));
    assertEquals(0, result.get("totalFound"));
  }

  @Test
  void testEveryFilterKeyTheQueryBuilderHandlesIsAccepted() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(new VectorSearchResponse(10L, Collections.emptyList()));

    // Validation must not reject a filter the engine understands. These two are not in the tool
    // schema but VectorSearchQueryBuilder has switch arms for them.
    Map<String, Object> params = new HashMap<>();
    params.put("query", "anything");
    params.put("filters", Map.of("parentId", List.of("abc"), "primaryEntityId", List.of("def")));

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertNull(result.get("error"));
  }

  @Test
  void testTopLevelMetricFacetIsRejectedToo() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "active users");
    params.put("granularity", "MONTH");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    assertTrue(result.get("error").toString().contains("granularity"));
    assertTrue(result.get("error").toString().contains("filters"));
  }

  @Test
  void testOversizedMetricExpressionIsCappedOnTheReadSide() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    // Entity-index hits never passed through the write-side cap — and on Elasticsearch, which has
    // no chunk index, every hit is an entity doc. An uncapped 30KB expression would crowd the
    // other results out of the response budget.
    Map<String, Object> hit = createHit("metric", "HugeMetric", "HugeMetric", 0.9);
    hit.put("metricExpression", Map.of("language", "SQL", "code", "x".repeat(30_000)));

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(new VectorSearchResponse(10L, List.of(hit)));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "huge");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    @SuppressWarnings("unchecked")
    Map<String, Object> cleaned = (Map<String, Object>) ((List<?>) result.get("results")).get(0);
    @SuppressWarnings("unchecked")
    Map<String, Object> expression = (Map<String, Object>) cleaned.get("metricExpression");
    assertTrue(
        ((String) expression.get("code")).length() < 1100,
        "the summary must cap a pathological expression");
    assertEquals("SQL", expression.get("language"), "other expression fields survive the cap");
  }

  @Test
  void testChunksOfOneEntityCollapseToASingleResult() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    Map<String, Object> best = createHit("page", "kb.long_article", "long_article", 0.91);
    best.put("parentId", "parent-1");
    best.put("chunkIndex", 0);
    Map<String, Object> weaker = createHit("page", "kb.long_article", "long_article", 0.62);
    weaker.put("parentId", "parent-1");
    weaker.put("chunkIndex", 3);
    Map<String, Object> other = createHit("page", "kb.other", "other", 0.55);
    other.put("parentId", "parent-2");

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(new VectorSearchResponse(10L, List.of(best, weaker, other)));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "anything");

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    List<?> results = (List<?>) result.get("results");
    assertEquals(2, results.size(), "each entity must appear once, not once per matching chunk");
    assertEquals(2, result.get("returnedCount"));
    @SuppressWarnings("unchecked")
    Map<String, Object> first = (Map<String, Object>) results.get(0);
    assertEquals(
        0.91, first.get("similarityScore"), "the best-scoring chunk must represent the entity");
  }

  @Test
  void testCollapsedCountKeepsNextCursorAlignedWithParentPaging() throws Exception {
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

    // Two entities, three chunk hits: a cursor built from the raw hit count would advance the
    // vector service's parent-offset by 3 and skip an entity on the next page.
    Map<String, Object> firstChunk = createHit("page", "kb.a", "a", 0.9);
    firstChunk.put("parentId", "parent-1");
    Map<String, Object> secondChunk = createHit("page", "kb.a", "a", 0.8);
    secondChunk.put("parentId", "parent-1");
    Map<String, Object> otherEntity = createHit("page", "kb.b", "b", 0.7);
    otherEntity.put("parentId", "parent-2");

    when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
        .thenReturn(
            new VectorSearchResponse(
                10L, List.of(firstChunk, secondChunk, otherEntity), null, true));

    Map<String, Object> params = new HashMap<>();
    params.put("query", "anything");
    params.put("size", 2);

    Map<String, Object> result = semanticSearchTool.execute(authorizer, securityContext, params);

    String cursor = (String) result.get("nextCursor");
    assertNotNull(cursor, "a full page with more in the index must advertise a cursor");
    assertEquals(2, PageCursor.decode(cursor).orElseThrow().offset());
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
