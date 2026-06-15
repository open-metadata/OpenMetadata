package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
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
