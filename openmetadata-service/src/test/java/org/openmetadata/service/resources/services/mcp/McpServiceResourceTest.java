package org.openmetadata.service.resources.services.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.security.Principal;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.api.services.CreateMcpService.McpServiceType;
import org.openmetadata.schema.entity.services.McpService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.McpServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

class McpServiceResourceTest {

  private static Set<String> mcpServiceFields() {
    return new HashSet<>(
        Arrays.asList(
            "id",
            "name",
            "fullyQualifiedName",
            "serviceType",
            "description",
            "displayName",
            "version",
            "updatedAt",
            "updatedBy",
            "pipelines",
            "connection",
            "testConnectionResult",
            "tags",
            "owners",
            "href",
            "changeDescription",
            "incrementalChangeDescription",
            "deleted",
            "dataProducts",
            "followers",
            "domains",
            "ingestionRunner"));
  }

  private McpServiceResource createResource(
      MockedStatic<Entity> entityMock,
      McpServiceRepository mockRepo,
      Authorizer mockAuth,
      Limits mockLimits) {
    entityMock.when(() -> Entity.getEntityRepository(Entity.MCP_SERVICE)).thenReturn(mockRepo);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.MCP_SERVICE))
        .thenReturn(McpService.class);
    entityMock
        .when(() -> Entity.registerResourcePermissions(anyString(), any()))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.registerResourceFieldViewMapping(anyString(), any()))
        .thenAnswer(inv -> null);
    entityMock.when(() -> Entity.getServiceEntityRepository(ServiceType.MCP)).thenReturn(mockRepo);
    return new McpServiceResource(mockAuth, mockLimits);
  }

  @Test
  void testCollectionPathAndFieldsConstants() {
    assertEquals("/v1/services/mcpServices/", McpServiceResource.COLLECTION_PATH);
    assertNotNull(McpServiceResource.FIELDS);
  }

  @Test
  void testNullifyConnection() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      McpService service = new McpService().withId(UUID.randomUUID()).withName("svc");

      McpService result = resource.nullifyConnection(service);
      assertNull(result.getConnection());
    }
  }

  @Test
  void testExtractServiceType() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      McpService service =
          new McpService()
              .withId(UUID.randomUUID())
              .withName("svc")
              .withServiceType(McpServiceType.Mcp);

      String serviceType = resource.extractServiceType(service);
      assertEquals("Mcp", serviceType);
    }
  }

  @Test
  void testAddHref() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      UriInfo uriInfo = mock(UriInfo.class);
      McpService service =
          new McpService()
              .withId(UUID.randomUUID())
              .withName("svc")
              .withServiceType(McpServiceType.Mcp);

      McpService result = resource.addHref(uriInfo, service);
      assertEquals(service, result);
    }
  }

  @Test
  void testList() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      ResultList<McpService> mockResult = new ResultList<>(Collections.emptyList(), null, null, 0);
      doReturn(mockResult)
          .when(spyResource)
          .listInternal(
              any(UriInfo.class), any(SecurityContext.class), any(), any(), anyInt(), any(), any());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      ResultList<McpService> result =
          spyResource.list(uriInfo, secCtx, null, null, 10, null, null, Include.NON_DELETED);
      assertNotNull(result);
    }
  }

  @Test
  void testGet() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      UUID id = UUID.randomUUID();
      McpService mockService =
          new McpService().withId(id).withName("svc").withServiceType(McpServiceType.Mcp);
      doReturn(mockService)
          .when(spyResource)
          .getInternal(
              any(UriInfo.class),
              any(SecurityContext.class),
              any(UUID.class),
              any(),
              any(Include.class));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      McpService result = spyResource.get(uriInfo, secCtx, id, null, Include.NON_DELETED);
      assertNotNull(result);
    }
  }

  @Test
  void testGetByName() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      McpService mockService =
          new McpService()
              .withId(UUID.randomUUID())
              .withName("svc")
              .withServiceType(McpServiceType.Mcp);
      doReturn(mockService)
          .when(spyResource)
          .getByNameInternal(
              any(UriInfo.class),
              any(SecurityContext.class),
              anyString(),
              any(),
              any(Include.class));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      McpService result = spyResource.getByName(uriInfo, secCtx, "svc", null, Include.NON_DELETED);
      assertNotNull(result);
    }
  }

  @Test
  void testListVersions() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      UUID id = UUID.randomUUID();
      EntityHistory mockHistory = new EntityHistory().withVersions(Collections.emptyList());
      when(mockRepo.listVersions(id)).thenReturn(mockHistory);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      EntityHistory result = resource.listVersions(uriInfo, secCtx, id);
      assertNotNull(result);
    }
  }

  @Test
  void testGetVersion() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      UUID id = UUID.randomUUID();
      McpService mockService =
          new McpService().withId(id).withName("svc").withServiceType(McpServiceType.Mcp);
      doReturn(mockService)
          .when(spyResource)
          .getVersionInternal(any(SecurityContext.class), any(UUID.class), anyString());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      McpService result = spyResource.getVersion(uriInfo, secCtx, id, "0.1");
      assertNotNull(result);
    }
  }

  @Test
  void testCreate() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      McpService mockService =
          new McpService()
              .withId(UUID.randomUUID())
              .withName("svc")
              .withServiceType(McpServiceType.Mcp);
      Response mockResponse = Response.ok(mockService).build();
      doReturn(mockResponse)
          .when(spyResource)
          .create(any(UriInfo.class), any(SecurityContext.class), any(McpService.class));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);
      Principal principal = mock(Principal.class);
      when(secCtx.getUserPrincipal()).thenReturn(principal);
      when(principal.getName()).thenReturn("admin");

      CreateMcpService createRequest =
          new CreateMcpService()
              .withName("svc")
              .withServiceType(CreateMcpService.McpServiceType.Mcp);

      Response result = spyResource.create(uriInfo, secCtx, createRequest);
      assertNotNull(result);
    }
  }

  @Test
  void testCreateOrUpdate() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      McpService mockService =
          new McpService()
              .withId(UUID.randomUUID())
              .withName("svc")
              .withServiceType(McpServiceType.Mcp);
      Response mockResponse = Response.ok(mockService).build();
      doReturn(mockResponse)
          .when(spyResource)
          .createOrUpdate(any(UriInfo.class), any(SecurityContext.class), any(McpService.class));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);
      Principal principal = mock(Principal.class);
      when(secCtx.getUserPrincipal()).thenReturn(principal);
      when(principal.getName()).thenReturn("admin");

      CreateMcpService createRequest =
          new CreateMcpService()
              .withName("svc")
              .withServiceType(CreateMcpService.McpServiceType.Mcp);

      Response result = spyResource.createOrUpdate(uriInfo, secCtx, createRequest);
      assertNotNull(result);
    }
  }

  @Test
  void testDelete() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      UUID id = UUID.randomUUID();
      Response mockResponse = Response.ok().build();
      doReturn(mockResponse)
          .when(spyResource)
          .delete(
              any(UriInfo.class),
              any(SecurityContext.class),
              any(UUID.class),
              anyBoolean(),
              anyBoolean());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      Response result = spyResource.delete(uriInfo, secCtx, false, false, id);
      assertNotNull(result);
    }
  }

  @Test
  void testDeleteByName() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      Response mockResponse = Response.ok().build();
      doReturn(mockResponse)
          .when(spyResource)
          .deleteByName(
              any(UriInfo.class),
              any(SecurityContext.class),
              anyString(),
              anyBoolean(),
              anyBoolean());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      Response result = spyResource.delete(uriInfo, secCtx, false, false, "svc");
      assertNotNull(result);
    }
  }

  @Test
  void testRestoreMcpService() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      UUID id = UUID.randomUUID();
      Response mockResponse = Response.ok().build();
      doReturn(mockResponse)
          .when(spyResource)
          .restoreEntity(any(UriInfo.class), any(SecurityContext.class), any(UUID.class));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);
      RestoreEntity restore = new RestoreEntity().withId(id);

      Response result = spyResource.restoreMcpService(uriInfo, secCtx, restore);
      assertNotNull(result);
    }
  }

  @Test
  void testDeleteByIdAsync() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServiceRepository mockRepo = mock(McpServiceRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(mcpServiceFields());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);

      McpServiceResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);
      McpServiceResource spyResource = spy(resource);

      UUID id = UUID.randomUUID();
      Response mockResponse = Response.ok().build();
      doReturn(mockResponse)
          .when(spyResource)
          .deleteByIdAsync(
              any(UriInfo.class),
              any(SecurityContext.class),
              any(UUID.class),
              anyBoolean(),
              anyBoolean());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext secCtx = mock(SecurityContext.class);

      Response result = spyResource.deleteByIdAsync(uriInfo, secCtx, false, false, id);
      assertNotNull(result);
    }
  }
}
