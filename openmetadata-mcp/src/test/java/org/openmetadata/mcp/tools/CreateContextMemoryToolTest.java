package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.context.ContextMemoryMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
class CreateContextMemoryToolTest {

  private static final String QUESTION = "Which warehouse should finance dashboards query?";
  private static final String ANSWER = "Always query the FINANCE_PROD warehouse.";

  private Authorizer authorizer;
  private Limits limits;
  private CatalogSecurityContext securityContext;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    limits = mock(Limits.class);
    securityContext = mock(CatalogSecurityContext.class);
  }

  @Test
  void testExecuteStampsRememberRequestProvenanceAndPersists() {
    Principal mockPrincipal = mock(Principal.class);
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);

    ContextMemoryRepository repo = mock(ContextMemoryRepository.class);
    ContextMemory memory = new ContextMemory();
    memory.setId(UUID.randomUUID());
    memory.setName("finance-warehouse");

    RestUtil.PutResponse<ContextMemory> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, memory, EventType.ENTITY_CREATED);
    when(repo.createOrUpdate(isNull(), any(ContextMemory.class), anyString(), any()))
        .thenReturn(putResponse);

    AtomicReference<CreateContextMemory> captured = new AtomicReference<>();
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<ContextMemoryMapper> mapperMock =
            mockConstruction(
                ContextMemoryMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(CreateContextMemory.class), anyString()))
                        .thenAnswer(
                            invocation -> {
                              captured.set(invocation.getArgument(0));
                              return memory;
                            }))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY)).thenReturn(repo);

      Map<String, Object> params = new HashMap<>();
      params.put("name", "finance-warehouse");
      params.put("question", QUESTION);
      params.put("answer", ANSWER);
      params.put("memoryType", "Preference");

      CreateContextMemoryTool tool = new CreateContextMemoryTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertNotNull(result);
      verify(repo).prepareInternal(any(ContextMemory.class), eq(false));

      CreateContextMemory create = captured.get();
      assertNotNull(create);
      assertEquals(ContextMemorySourceType.REMEMBER_REQUEST, create.getSourceType());
      assertEquals(QUESTION, create.getQuestion());
      assertEquals(ANSWER, create.getAnswer());
      assertEquals(ContextMemoryType.PREFERENCE, create.getMemoryType());
    }
  }

  @Test
  void testMissingRequiredAnswerThrows() {
    Map<String, Object> params = new HashMap<>();
    params.put("name", "finance-warehouse");
    params.put("question", QUESTION);

    CreateContextMemoryTool tool = new CreateContextMemoryTool();
    assertThrows(
        IllegalArgumentException.class,
        () -> tool.execute(authorizer, limits, securityContext, params));
  }

  @Test
  void testInvalidMemoryTypeThrows() {
    assertThrows(
        IllegalArgumentException.class, () -> CreateContextMemoryTool.parseMemoryType("NotAType"));
  }

  @Test
  void testParseMemoryScopeAcceptsValidValue() {
    assertEquals(
        ContextMemoryScope.ENTITY_SCOPED, CreateContextMemoryTool.parseMemoryScope("EntityScoped"));
  }
}
