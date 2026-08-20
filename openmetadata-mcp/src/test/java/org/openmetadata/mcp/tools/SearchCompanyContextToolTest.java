package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@ExtendWith(MockitoExtension.class)
class SearchCompanyContextToolTest {

  private final SearchCompanyContextTool tool = new SearchCompanyContextTool();
  private MockedStatic<Entity> entityMock;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    entityMock
        .when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
        .thenReturn(mock(ContextMemoryRepository.class));
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  @Test
  void missingQueryReturnsError() throws Exception {
    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), new HashMap<>());

    assertEquals("'query' parameter is required", result.get("error"));
    assertEquals(0, result.get("returnedCount"));
  }

  @Test
  void blankQueryReturnsError() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "   ");

    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

    assertEquals("'query' parameter is required", result.get("error"));
  }

  @Test
  void cursorThreadsOffsetIntoVectorSearchClosingThePagingGap() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    VectorSearchResponse response = new VectorSearchResponse(5L, Collections.emptyList());

    try (MockedStatic<OpenSearchVectorService> vectorMock =
        mockStatic(OpenSearchVectorService.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      ArgumentCaptor<Integer> fromCaptor = ArgumentCaptor.forClass(Integer.class);
      when(vectorService.search(anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "refund policy");
      params.put("cursor", PageCursor.encodeOffset(40));

      tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

      verify(vectorService)
          .search(anyString(), anyMap(), anyInt(), fromCaptor.capture(), anyInt(), anyDouble());
      assertEquals(40, fromCaptor.getValue());
    }
  }

  @Test
  void deniedAuthorizationPropagates() {
    Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () ->
            tool.execute(
                authorizer, mock(CatalogSecurityContext.class), Map.of("query", "refund policy")));
  }
}
