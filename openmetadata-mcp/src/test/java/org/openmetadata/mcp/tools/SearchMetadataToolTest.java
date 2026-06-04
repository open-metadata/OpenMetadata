package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.SearchRequest;
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
  void testEntityTypeResolvesToOwnIndexNotDataAsset() throws Exception {
    // Regression for #27796: databaseService is absent from the legacy switch and not part of the
    // dataAsset alias, so it must resolve to its own index rather than falling back to dataAsset.
    SearchRequest sent =
        captureRequestForEntityType("databaseService", "database_service_search_index");

    verify(searchRepository).getIndexOrAliasName("databaseService");
    assertEquals("database_service_search_index", sent.getIndex());
    assertEquals("test", sent.getQuery());
  }

  @Test
  void testChartResolvesToOwnIndex() throws Exception {
    SearchRequest sent = captureRequestForEntityType("chart", "chart_search_index");

    verify(searchRepository).getIndexOrAliasName("chart");
    assertEquals("chart_search_index", sent.getIndex());
  }

  @Test
  void testNullEntityTypeUsesDataAsset() throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");

      when(searchRepository.getIndexOrAliasName("dataAsset")).thenReturn("dataAsset");
      stubEmptySearch();

      searchMetadataTool.execute(authorizer, securityContext, params);

      verify(searchRepository).getIndexOrAliasName("dataAsset");
    }
  }

  private SearchRequest captureRequestForEntityType(String entityType, String resolvedIndex)
      throws Exception {
    try (MockedStatic<SubjectCache> subjectCacheMock = mockStatic(SubjectCache.class)) {
      subjectCacheMock.when(() -> SubjectCache.getUserContext("test-user")).thenReturn(mockUser);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "test");
      params.put("entityType", entityType);

      when(searchRepository.getIndexOrAliasName(entityType)).thenReturn(resolvedIndex);
      stubEmptySearch();

      searchMetadataTool.execute(authorizer, securityContext, params);

      ArgumentCaptor<SearchRequest> captor = ArgumentCaptor.forClass(SearchRequest.class);
      verify(searchRepository).search(captor.capture(), any(SubjectContext.class));
      return captor.getValue();
    }
  }

  private void stubEmptySearch() throws Exception {
    Response mockResponse = mock(Response.class);
    when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[],\"total\":{\"value\":0}}}");
    when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);
  }
}
