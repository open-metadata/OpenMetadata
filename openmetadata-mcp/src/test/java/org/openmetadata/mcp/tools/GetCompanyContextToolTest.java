package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@ExtendWith(MockitoExtension.class)
class GetCompanyContextToolTest {

  private final GetCompanyContextTool tool = new GetCompanyContextTool();
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
  void missingFqnReturnsError() throws Exception {
    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), new HashMap<>());

    assertEquals("'fqn' parameter is required", result.get("error"));
  }

  @Test
  void blankFqnReturnsError() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("fqn", "   ");

    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

    assertEquals("'fqn' parameter is required", result.get("error"));
  }

  @Test
  void deniedAuthorizationPropagates() {
    Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () -> tool.execute(authorizer, mock(CatalogSecurityContext.class), Map.of("fqn", "x")));
  }

  @Test
  void sharedFilePillIsProjected() throws Exception {
    stubMemory(
        "pill-fqn",
        memory("pill-fqn", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.SHARED));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class), mock(CatalogSecurityContext.class), Map.of("fqn", "pill-fqn"));

    assertEquals("Q", result.get("question"));
    assertEquals("A", result.get("answer"));
  }

  @Test
  void unquotedDottedFqnResolvesToQuotedPill() throws Exception {
    stubMemory(
        "\"report.md_hash\"",
        memory("report.md_hash", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.SHARED));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class),
            mock(CatalogSecurityContext.class),
            Map.of("fqn", "report.md_hash"));

    assertEquals("Q", result.get("question"));
    assertEquals("A", result.get("answer"));
  }

  @Test
  void missingPillReturnsErrorInsteadOfThrowing() throws Exception {
    entityMock
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.CONTEXT_MEMORY), anyString(), anyString(), isNull()))
        .thenThrow(new EntityNotFoundException("contextMemory instance for ghost not found"));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class), mock(CatalogSecurityContext.class), Map.of("fqn", "ghost"));

    assertEquals("No Company Context knowledge pill found for 'ghost'", result.get("error"));
  }

  @Test
  void nonFileMemoryReturnsError() throws Exception {
    stubMemory(
        "chat-fqn",
        memory("chat-fqn", ContextMemorySourceType.CHAT_PROMOTION, MemoryVisibility.SHARED));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class), mock(CatalogSecurityContext.class), Map.of("fqn", "chat-fqn"));

    assertEquals(
        "Requested entity is not a shared Company Context knowledge pill", result.get("error"));
  }

  @Test
  void privateFilePillReturnsError() throws Exception {
    stubMemory(
        "private-fqn",
        memory("private-fqn", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.PRIVATE));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class),
            mock(CatalogSecurityContext.class),
            Map.of("fqn", "private-fqn"));

    assertEquals(
        "Requested entity is not a shared Company Context knowledge pill", result.get("error"));
  }

  private void stubMemory(String fqn, ContextMemory memory) {
    entityMock
        .when(
            () -> Entity.getEntityByName(eq(Entity.CONTEXT_MEMORY), eq(fqn), anyString(), isNull()))
        .thenReturn(memory);
  }

  private ContextMemory memory(
      String fqn, ContextMemorySourceType sourceType, MemoryVisibility visibility) {
    return new ContextMemory()
        .withName(fqn)
        .withFullyQualifiedName(fqn)
        .withQuestion("Q")
        .withAnswer("A")
        .withSourceType(sourceType)
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }
}
