package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@ExtendWith(MockitoExtension.class)
class SearchMetadataToolTest {

  private SearchMetadataTool searchMetadataTool;
  private Authorizer authorizer;
  private CatalogSecurityContext securityContext;
  private SearchRepository searchRepository;

  @BeforeEach
  void setUp() {
    searchMetadataTool = new SearchMetadataTool();
    authorizer = mock(Authorizer.class);
    securityContext = mock(CatalogSecurityContext.class);
    searchRepository = mock(SearchRepository.class);

    Entity.setSearchRepository(searchRepository);
  }

  @Test
  void testSearchWithClusterAlias() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("limit", 10);

    when(searchRepository.getIndexOrAliasName("table_search_index"))
        .thenReturn("openmetadata_table_search_index");

    Response mockResponse = mock(Response.class);
    when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[]}}");
    when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

    Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(java.util.Collections.emptyMap(), result);
  }

  @Test
  void testSearchWithoutClusterAlias() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("limit", 10);

    when(searchRepository.getIndexOrAliasName("table_search_index"))
        .thenReturn("table_search_index");

    Response mockResponse = mock(Response.class);
    when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[]}}");
    when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

    Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(java.util.Collections.emptyMap(), result);
  }

  @Test
  void testSearchWithSpecificEntityType() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "test");
    params.put("entity_type", "dashboard");
    params.put("limit", 10);

    when(searchRepository.getIndexOrAliasName("dashboard_search_index"))
        .thenReturn("openmetadata_dashboard_search_index");

    Response mockResponse = mock(Response.class);
    when(mockResponse.getEntity()).thenReturn("{\"hits\":{\"hits\":[]}}");
    when(searchRepository.search(any(), any(SubjectContext.class))).thenReturn(mockResponse);

    Map<String, Object> result = searchMetadataTool.execute(authorizer, securityContext, params);

    assertNotNull(result);
    assertEquals(java.util.Collections.emptyMap(), result);
  }
}
