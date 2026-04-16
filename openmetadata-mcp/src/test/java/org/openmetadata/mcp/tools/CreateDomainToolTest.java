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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.domains.DomainMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.RestUtil;

@ExtendWith(MockitoExtension.class)
class CreateDomainToolTest {

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
  void testCreateDomainToolExecution() {
    DomainRepository repo = mock(DomainRepository.class);
    Domain domain = new Domain();
    domain.setId(UUID.randomUUID());
    domain.setName("TestDomain");

    RestUtil.PutResponse<Domain> putResponse =
        new RestUtil.PutResponse<>(Response.Status.CREATED, domain, EventType.ENTITY_CREATED);

    when(repo.createOrUpdate(isNull(), any(Domain.class), anyString(), isNull()))
        .thenReturn(putResponse);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
         MockedStatic<McpChangeEventUtil> eventMock = mockStatic(McpChangeEventUtil.class);
         MockedConstruction<DomainMapper> mapperMock =
             mockConstruction(
                 DomainMapper.class,
                 (mapper, context) ->
                     when(mapper.createToEntity(any(), anyString())).thenReturn(domain))) {

      entityMock.when(() -> Entity.getEntityRepository(Entity.DOMAIN)).thenReturn(repo);

      Map<String, Object> params = new HashMap<>();
      params.put("name", "TestDomain");
      params.put("description", "A test domain");
      params.put("domainType", "Aggregate");

      CreateDomainTool tool = new CreateDomainTool();
      Map<String, Object> result = tool.execute(authorizer, limits, securityContext, params);

      assertNotNull(result);
      assertEquals("TestDomain", result.get("name"));
      assertNotNull(result.get("id"));

      verify(limits).enforceLimits(any(), any(), any());
      verify(authorizer).authorize(any(), any(), any());
      verify(repo).prepareInternal(any(Domain.class), eq(false));
      eventMock.verify(
          () ->
              McpChangeEventUtil.publishChangeEvent(
                  any(Domain.class), any(EventType.class), anyString()));
    }
  }

  @Test
  void testMissingRequiredParameterThrowsException() {
    CreateDomainTool tool = new CreateDomainTool();
    Map<String, Object> params = new HashMap<>();

    // Missing 'name'
    params.put("description", "A test domain");
    params.put("domainType", "Aggregate");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> tool.execute(authorizer, limits, securityContext, params));
    assertEquals(
        "Parameter 'name' is required and must be a non-blank string. Received: null",
        exception.getMessage());
  }

  @Test
  void testInvalidDomainTypeThrowsException() {
    CreateDomainTool tool = new CreateDomainTool();
    Map<String, Object> params = new HashMap<>();

    params.put("name", "TestDomain");
    params.put("description", "A test domain");
    params.put("domainType", "InvalidType"); // Invalid enum value

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> tool.execute(authorizer, limits, securityContext, params));
    assertEquals(
        "Parameter 'domainType' has invalid value 'InvalidType'. Valid values are: Aggregate, Source-aligned, Consumer-aligned",
        exception.getMessage());
  }
}
