package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
class GlossaryToolTest {

  private Authorizer authorizer;
  private Limits limits;
  private CatalogSecurityContext securityContext;

  @BeforeEach
  void setUp() {
    authorizer = mock(Authorizer.class);
    limits = mock(Limits.class);
    securityContext = mock(CatalogSecurityContext.class);

    Principal mockPrincipal = mock(Principal.class);
    when(mockPrincipal.getName()).thenReturn("test-user");
    when(securityContext.getUserPrincipal()).thenReturn(mockPrincipal);
  }

  @Test
  void testExecuteCallsPrepareInternal() {
    GlossaryRepository repo = mock(GlossaryRepository.class);
    Glossary glossary = new Glossary();
    glossary.setId(UUID.randomUUID());
    glossary.setName("TestGlossary");

    RestUtil.PutResponse<Glossary> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, glossary, EventType.ENTITY_CREATED);

    when(repo.createOrUpdate(isNull(), any(Glossary.class), anyString(), any()))
        .thenReturn(putResponse);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<GlossaryMapper> mapperMock =
            mockConstruction(
                GlossaryMapper.class,
                (mapper, context) ->
                    when(mapper.createToEntity(any(), anyString())).thenReturn(glossary))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.GLOSSARY)).thenReturn(repo);

      Map<String, Object> params = new HashMap<>();
      params.put("name", "TestGlossary");
      params.put("description", "A test glossary");
      params.put("mutuallyExclusive", false);

      GlossaryTool tool = new GlossaryTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertNotNull(result);
      verify(repo).prepareInternal(any(Glossary.class), eq(false));
    }
  }
}
