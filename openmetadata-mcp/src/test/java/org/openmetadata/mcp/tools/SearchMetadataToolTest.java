package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Unit tests for SearchMetadataTool.
 *
 * <p>Tests verify the correct behavior of SearchMetadataTool including:
 * - Index name resolution with cluster aliases
 * - Entity type-specific searches
 * - Default dataAsset index usage when no entity type is specified
 * - Response formatting and structure
 */
@ExtendWith(MockitoExtension.class)
class SearchMetadataToolTest {

  private SearchMetadataTool searchMetadataTool;
  private Authorizer authorizer;
  private CatalogSecurityContext securityContext;
  private SearchRepository searchRepository;
  private User mockUser;

  @BeforeEach
  void setUp() {
    searchMetadataTool = new SearchMetadataTool();
    authorizer = mock(Authorizer.class);
    securityContext = mock(CatalogSecurityContext.class);
    searchRepository = mock(SearchRepository.class);

    Principal mockPrincipal = mock(Principal.class);
    lenient().when(mockPrincipal.getName()).thenReturn("test-user");
    lenient().when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);

    mockUser = new User();
    mockUser.setId(UUID.randomUUID());
    mockUser.setName("test-user");
    mockUser.setIsAdmin(false);
    mockUser.setIsBot(false);

    Entity.setSearchRepository(searchRepository);
  }

  @Test
  void testSearchWithClusterAlias() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("size", 10);

      when(searchRepository.getIndexOrAliasName("dataAsset")).thenReturn("openmetadata_dataAsset");

      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

      Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
      assertEquals(0, result.get("returnedCount"));
      assertNotNull(result.get("results"));
    }
  }

  @Test
  void testSearchWithoutClusterAlias() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("size", 10);

      when(searchRepository.getIndexOrAliasName("dataAsset")).thenReturn("dataAsset");

      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

      Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
      assertEquals(0, result.get("returnedCount"));
      assertNotNull(result.get("results"));
    }
  }

  @Test
  void testSearchWithSpecificEntityType() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("entityType", "dashboard");
      params.put("size", 10);

      when(searchRepository.getIndexMapping("dashboard")).thenReturn(mock(IndexMapping.class));
      when(searchRepository.getIndexOrAliasName("dashboard")).thenReturn("openmetadata_dashboard");

      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

      Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      assertEquals(0, result.get("totalFound"));
      assertEquals(0, result.get("returnedCount"));
      assertNotNull(result.get("results"));
    }
  }

  @Test
  void testRegisteredEntityTypeResolvesToOwnIndex() {
    // Regression for #27796: databaseService is absent from the legacy switch and not part of the
    // dataAsset alias, so it must resolve to its own index rather than falling back to dataAsset.
    when(searchRepository.getIndexMapping("databaseService")).thenReturn(mock(IndexMapping.class));

    assertEquals("databaseService", SearchMetadataTool.resolveIndex("databaseService"));
  }

  @Test
  void testUnregisteredEntityTypeFallsBackToDataAsset() {
    when(searchRepository.getIndexMapping("bogusType")).thenReturn(null);

    assertEquals("dataAsset", SearchMetadataTool.resolveIndex("bogusType"));
  }

  @Test
  void testWildcardAndCommaInputFallBackToDataAsset() {
    when(searchRepository.getIndexMapping(any())).thenReturn(null);

    assertEquals("dataAsset", SearchMetadataTool.resolveIndex("*"));
    assertEquals("dataAsset", SearchMetadataTool.resolveIndex("_all"));
    assertEquals("dataAsset", SearchMetadataTool.resolveIndex("table,user"));
  }

  @Test
  void testNullEntityTypeUsesDataAsset() {
    assertEquals("dataAsset", SearchMetadataTool.resolveIndex(null));
    assertEquals("dataAsset", SearchMetadataTool.resolveIndex(""));
  }

  @Test
  void testNonStringEntityTypeDoesNotThrow() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("entityType", 123);

      when(searchRepository.getIndexMapping("123")).thenReturn(null);
      when(searchRepository.getIndexOrAliasName("dataAsset")).thenReturn("dataAsset");
      stubEmptySearch();

      Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      verify(searchRepository).getIndexOrAliasName("dataAsset");
    }
  }

  @Test
  void testQueryFilterAsJsonObjectIsSerialized() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("queryFilter", Map.of("query", Map.of("term", Map.of("entityType", "table"))));

      when(searchRepository.getIndexOrAliasName("dataAsset")).thenReturn("dataAsset");
      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.searchWithDirectQuery(any(), any(SubjectContext.class)))
          .thenReturn(mockResponse);

      Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

      assertNotNull(result);
      ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
      verify(searchRepository).searchWithDirectQuery(captor.capture(), any(SubjectContext.class));
      assertEquals(
          "table",
          JsonUtils.readTree(captor.getValue().getQueryFilter())
              .at("/query/term/entityType")
              .asText());
    }
  }

  @Test
  void testSearchRequestTargetsResolvedEntityTypeIndex() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("entityType", "chart");

      when(searchRepository.getIndexMapping("chart")).thenReturn(mock(IndexMapping.class));
      when(searchRepository.getIndexOrAliasName("chart")).thenReturn("chart_search_index");
      stubEmptySearch();

      searchMetadataTool.execute(authorizer, securityContext, params);

      ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
      verify(searchRepository).search(captor.capture(), any(SubjectContext.class));
      assertEquals("chart_search_index", captor.getValue().getIndex());
      assertEquals("test", captor.getValue().getQuery());
    }
  }

  private void stubEmptySearch() throws Exception {
    Response mockResponse = mock(Response.class);
    when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
    when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);
  }

  @Test
  void testResultsIncludeSimilarityScoreFromScore() {
    Map<String, Object> searchResponse =
        searchResponseWith(buildHit(12.5, "db.schema.users"), buildHit(8.0, "db.schema.orders"));

    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "users", 10, List.of(), false, 0);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> results = (List<Map<String, Object>>) result.get("results");
    assertEquals(2, results.size());
    assertEquals(12.5, results.get(0).get("similarityScore"));
    assertEquals(8.0, results.get(1).get("similarityScore"));
  }

  @Test
  void testResultOmitsSimilarityScoreWhenScoreMissing() {
    Map<String, Object> hit = new HashMap<>();
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "table");
    source.put("fullyQualifiedName", "db.schema.users");
    hit.put("_source", source);

    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponseWith(hit), "users", 10, List.of(), false, 0);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> results = (List<Map<String, Object>>) result.get("results");
    assertEquals(1, results.size());
    assertFalse(results.get(0).containsKey("similarityScore"));
  }

  @Test
  void testTestCaseAndTestSuiteResolveToOwnIndexes() {
    // Regression for collate#4323: test cases/suites are not part of the dataAsset alias, so they
    // must resolve to their own indexes for data quality search to work.
    when(searchRepository.getIndexMapping("testCase")).thenReturn(mock(IndexMapping.class));
    when(searchRepository.getIndexMapping("testSuite")).thenReturn(mock(IndexMapping.class));

    assertEquals("testCase", SearchMetadataTool.resolveIndex("testCase"));
    assertEquals("testSuite", SearchMetadataTool.resolveIndex("testSuite"));
  }

  @Test
  void testCleanSearchResultKeepsTestCaseFields() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "testCase");
    source.put("fullyQualifiedName", "svc.db.schema.users.id.column_values_to_be_unique");
    source.put("entityFQN", "svc.db.schema.users.id");
    source.put("originEntityFQN", "svc.db.schema.users");
    source.put("testCaseStatus", "Failed");
    source.put("testCaseType", "column");
    source.put("dataQualityDimension", "Uniqueness");
    source.put("testPlatforms", List.of("OpenMetadata"));

    Map<String, Object> result = SearchMetadataTool.cleanSearchResult(source, List.of());

    assertEquals("svc.db.schema.users.id", result.get("entityFQN"));
    assertEquals("svc.db.schema.users", result.get("originEntityFQN"));
    assertEquals("Failed", result.get("testCaseStatus"));
    assertEquals("column", result.get("testCaseType"));
    assertEquals("Uniqueness", result.get("dataQualityDimension"));
    assertEquals(List.of("OpenMetadata"), result.get("testPlatforms"));
  }

  @Test
  void testCleanSearchResultKeepsTestSuiteFields() {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "testSuite");
    source.put("fullyQualifiedName", "svc.db.schema.users.testSuite");
    source.put("basic", true);
    source.put("lastResultTimestamp", 1768222130752L);

    Map<String, Object> result = SearchMetadataTool.cleanSearchResult(source, List.of());

    assertEquals(true, result.get("basic"));
    assertEquals(1768222130752L, result.get("lastResultTimestamp"));
  }

  @Test
  void testCleanSearchResultSlimsTestCaseResult() {
    Map<String, Object> testCaseResult = new HashMap<>();
    testCaseResult.put("testCaseStatus", "Failed");
    testCaseResult.put("timestamp", 1768222130752L);
    testCaseResult.put("result", "Found min=1001 vs. expected min=90001");
    testCaseResult.put("testResultValue", List.of(Map.of("name", "min", "value", "1001")));
    testCaseResult.put("id", "5c0b4b32-b4ec-4570-b3b9-025d3fdf264b");

    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "testCase");
    source.put("testCaseResult", testCaseResult);

    Map<String, Object> result = SearchMetadataTool.cleanSearchResult(source, List.of());

    @SuppressWarnings("unchecked")
    Map<String, Object> slim = (Map<String, Object>) result.get("testCaseResult");
    assertNotNull(slim);
    assertEquals("Failed", slim.get("testCaseStatus"));
    assertEquals(1768222130752L, slim.get("timestamp"));
    assertEquals("Found min=1001 vs. expected min=90001", slim.get("result"));
    assertFalse(slim.containsKey("testResultValue"));
    assertFalse(slim.containsKey("id"));
  }

  @Test
  void testCleanSearchResultReturnsFullTestCaseResultWhenRequested() {
    Map<String, Object> testCaseResult = new HashMap<>();
    testCaseResult.put("testCaseStatus", "Failed");
    testCaseResult.put("testResultValue", List.of(Map.of("name", "min", "value", "1001")));

    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "testCase");
    source.put("testCaseResult", testCaseResult);

    Map<String, Object> result =
        SearchMetadataTool.cleanSearchResult(source, List.of("testCaseResult"));

    @SuppressWarnings("unchecked")
    Map<String, Object> full = (Map<String, Object>) result.get("testCaseResult");
    assertEquals(testCaseResult, full);
  }

  @Test
  void trimMessageUsesAbsoluteNextOffsetWhenPaging() {
    List<Map<String, Object>> hits = new ArrayList<>();
    for (int i = 0; i < 5000; i++) {
      hits.add(buildHit(1.0, "svc.db.schema.table_" + i));
    }
    Map<String, Object> hitsContainer = new HashMap<>();
    hitsContainer.put("hits", hits);
    hitsContainer.put("total", Map.of("value", hits.size()));
    Map<String, Object> searchResponse = new HashMap<>();
    searchResponse.put("hits", hitsContainer);

    int from = 20;
    Map<String, Object> result =
        SearchMetadataTool.buildEnhancedSearchResponse(
            searchResponse, "tables", 5000, from, List.of(), false, 0);

    int returnedCount = (int) result.get("returnedCount");
    assertTrue(returnedCount < 5000, "results should have been trimmed to fit the budget");
    assertEquals(true, result.get("hasMore"));
    String message = (String) result.get("message");
    assertTrue(
        message.contains("'from'=" + (from + returnedCount)),
        "next-page hint must be absolute (from + returnedCount): " + message);
  }

  private Map<String, Object> buildHit(double score, String fqn) {
    Map<String, Object> source = new HashMap<>();
    source.put("entityType", "table");
    source.put("fullyQualifiedName", fqn);

    Map<String, Object> hit = new HashMap<>();
    hit.put("_score", score);
    hit.put("_source", source);
    return hit;
  }

  @SafeVarargs
  private final Map<String, Object> searchResponseWith(Map<String, Object>... hits) {
    Map<String, Object> hitsContainer = new HashMap<>();
    hitsContainer.put("hits", List.of(hits));
    hitsContainer.put("total", Map.of("value", hits.length));

    Map<String, Object> searchResponse = new HashMap<>();
    searchResponse.put("hits", hitsContainer);
    return searchResponse;
  }
}
