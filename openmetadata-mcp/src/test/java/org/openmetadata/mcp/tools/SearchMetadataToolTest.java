package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.utils.JsonUtils;
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
@MockitoSettings(strictness = Strictness.LENIENT)
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
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);

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
  void testEntityTypeIsAlwaysAppliedAsExplicitFilter() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("entityType", "metric");

      when(searchRepository.getIndexOrAliasName("metric")).thenReturn("metric");

      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

      searchMetadataTool.execute(authorizer, securityContext, params);

      ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
      verify(searchRepository).search(captor.capture(), any(SubjectContext.class));

      SearchRequest sent = captor.getValue();
      assertEquals("test", sent.getQuery());
      assertNotNull(sent.getQueryFilter());
      JsonNode filter = JsonUtils.readTree(sent.getQueryFilter());
      assertEquals("metric", filter.at("/query/bool/filter/0/term/entityType").asText());
    }
  }

  @Test
  void testNoEntityTypeLeavesQueryFilterEmpty() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");

      when(searchRepository.getIndexOrAliasName("dataAsset")).thenReturn("dataAsset");

      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

      searchMetadataTool.execute(authorizer, securityContext, params);

      ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
      verify(searchRepository).search(captor.capture(), any(SubjectContext.class));

      SearchRequest sent = captor.getValue();
      assertEquals("test", sent.getQuery());
      assertNull(sent.getQueryFilter());
    }
  }

  @Test
  void testAddEntityTypeFilterWithoutExistingFilter() throws Exception {
    String result = SearchMetadataTool.addEntityTypeFilter(null, "metric");
    assertNotNull(result);
    JsonNode root = JsonUtils.readTree(result);
    assertEquals("metric", root.at("/query/bool/filter/0/term/entityType").asText());
  }

  @Test
  void testAddEntityTypeFilterWrapsExistingBoolQuery() throws Exception {
    String existing = "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"owners.name\":\"team\"}}]}}}";
    String result = SearchMetadataTool.addEntityTypeFilter(existing, "topic");
    JsonNode root = JsonUtils.readTree(result);
    assertEquals("topic", root.at("/query/bool/filter/0/term/entityType").asText());
    assertEquals("team", root.at("/query/bool/must/0/term/owners.name").asText());
  }

  @Test
  void testAddEntityTypeFilterWrapsNonBoolQuery() throws Exception {
    String existing = "{\"query\":{\"term\":{\"owners.name\":\"team\"}}}";
    String result = SearchMetadataTool.addEntityTypeFilter(existing, "pipeline");
    JsonNode root = JsonUtils.readTree(result);
    assertEquals("pipeline", root.at("/query/bool/filter/0/term/entityType").asText());
    assertEquals("team", root.at("/query/bool/must/0/term/owners.name").asText());
  }

  @Test
  void testAddEntityTypeFilterIsNoopWhenEntityTypeMissing() {
    String existing = "{\"query\":{\"term\":{\"owners.name\":\"team\"}}}";
    assertEquals(existing, SearchMetadataTool.addEntityTypeFilter(existing, null));
    assertEquals(existing, SearchMetadataTool.addEntityTypeFilter(existing, ""));
    assertEquals(existing, SearchMetadataTool.addEntityTypeFilter(existing, "  "));
    assertNull(SearchMetadataTool.addEntityTypeFilter(null, null));
  }

  @Test
  void testEntityTypeFilterMergesWithUserQueryFilter() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("entityType", "metric");
      params.put(
          "queryFilter",
          "{\"query\":{\"bool\":{\"must\":[{\"term\":{\"owners.name\":\"finance\"}}]}}}");

      when(searchRepository.getIndexOrAliasName("metric")).thenReturn("metric");

      Response mockResponse = mock(Response.class);
      when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
      when(searchRepository.searchWithDirectQuery(any(), any(SubjectContext.class)))
          .thenReturn(mockResponse);

      searchMetadataTool.execute(authorizer, securityContext, params);

      ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
      verify(searchRepository).searchWithDirectQuery(captor.capture(), any(SubjectContext.class));

      SearchRequest sent = captor.getValue();
      JsonNode filter = JsonUtils.readTree(sent.getQueryFilter());
      assertEquals("metric", filter.at("/query/bool/filter/0/term/entityType").asText());
      assertEquals("finance", filter.at("/query/bool/must/0/term/owners.name").asText());
    }
  }
}
