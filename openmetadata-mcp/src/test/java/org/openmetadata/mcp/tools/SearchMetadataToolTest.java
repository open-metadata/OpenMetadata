package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.security.Principal;
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
