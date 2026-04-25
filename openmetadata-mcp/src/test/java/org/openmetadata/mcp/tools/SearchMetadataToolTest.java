package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.teams.User;
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

  // --- Query safety validation tests ---

  @Test
  void testValidateQuerySafety_blocksScriptQuery() throws Exception {
    String maliciousQuery =
        "{\"query\":{\"script\":{\"script\":{\"source\":\"doc['field'].value * 2\"}}}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(maliciousQuery);

    IOException ex = assertThrows(IOException.class, () -> SearchMetadataTool.validateQuerySafety(node));
    assertTrue(ex.getMessage().contains("script"));
  }

  @Test
  void testValidateQuerySafety_blocksScriptScoreQuery() throws Exception {
    String maliciousQuery =
        "{\"query\":{\"script_score\":{\"query\":{\"match_all\":{}},\"script\":{\"source\":\"1\"}}}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(maliciousQuery);

    IOException ex = assertThrows(IOException.class, () -> SearchMetadataTool.validateQuerySafety(node));
    assertTrue(ex.getMessage().contains("script_score"));
  }

  @Test
  void testValidateQuerySafety_blocksWrapperQuery() throws Exception {
    String maliciousQuery =
        "{\"query\":{\"wrapper\":{\"query\":\"eyJtYXRjaCI6e319\"}}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(maliciousQuery);

    IOException ex = assertThrows(IOException.class, () -> SearchMetadataTool.validateQuerySafety(node));
    assertTrue(ex.getMessage().contains("wrapper"));
  }

  @Test
  void testValidateQuerySafety_blocksNestedScript() throws Exception {
    // Script hidden inside a bool -> should clause
    String maliciousQuery =
        "{\"query\":{\"bool\":{\"should\":[{\"script\":{\"script\":{\"source\":\"painful\"}}}]}}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(maliciousQuery);

    IOException ex = assertThrows(IOException.class, () -> SearchMetadataTool.validateQuerySafety(node));
    assertTrue(ex.getMessage().contains("script"));
  }

  @Test
  void testValidateQuerySafety_allowsSafeQuery() throws Exception {
    String safeQuery =
        "{\"query\":{\"bool\":{\"must\":[{\"match\":{\"name\":\"test\"}}],\"filter\":[{\"term\":{\"deleted\":false}}]}}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(safeQuery);

    // Should not throw
    SearchMetadataTool.validateQuerySafety(node);
  }

  @Test
  void testValidateQuerySafety_blocksPercolatorQuery() throws Exception {
    String maliciousQuery =
        "{\"query\":{\"percolator\":{\"field\":\"query\"}}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(maliciousQuery);

    IOException ex = assertThrows(IOException.class, () -> SearchMetadataTool.validateQuerySafety(node));
    assertTrue(ex.getMessage().contains("percolator"));
  }

  @Test
  void testValidateQuerySafety_blocksScriptedMetric() throws Exception {
    String maliciousQuery =
        "{\"scripted_metric\":{\"init_script\":\"state.transactions = []\"}}";
    JsonNode node = JsonUtils.getObjectMapper().readTree(maliciousQuery);

    IOException ex = assertThrows(IOException.class, () -> SearchMetadataTool.validateQuerySafety(node));
    assertTrue(ex.getMessage().contains("scripted_metric"));
  }
}
