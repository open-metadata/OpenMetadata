package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.api.data.RestoreEntity;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.McpServerRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

class McpServerResourceTest {

  private McpServerResource createResource(
      MockedStatic<Entity> entityMock,
      McpServerRepository mockRepo,
      Authorizer mockAuth,
      Limits mockLimits) {
    entityMock.when(() -> Entity.getEntityRepository(Entity.MCP_SERVER)).thenReturn(mockRepo);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.MCP_SERVER))
        .thenReturn(McpServer.class);
    entityMock
        .when(() -> Entity.registerResourcePermissions(anyString(), any()))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.registerResourceFieldViewMapping(anyString(), any()))
        .thenAnswer(inv -> null);
    return new McpServerResource(mockAuth, mockLimits);
  }

  @Test
  void testCollectionPathAndFieldsConstants() {
    assertEquals("/v1/mcpServers/", McpServerResource.COLLECTION_PATH);
    assertNotNull(McpServerResource.FIELDS);
  }

  @Test
  void testGetEntitySpecificOperations() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      List<MetadataOperation> ops = resource.getEntitySpecificOperations();

      assertNotNull(ops);
      assertEquals(2, ops.size());
      assertEquals(MetadataOperation.VIEW_USAGE, ops.get(0));
      assertEquals(MetadataOperation.EDIT_USAGE, ops.get(1));
    }
  }

  @Test
  void testAddHref() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      UriInfo uriInfo = mock(UriInfo.class);
      McpServer server = new McpServer().withId(UUID.randomUUID()).withName("srv");

      McpServer result = resource.addHref(uriInfo, server);
      assertNotNull(result);
    }
  }

  @Test
  void testList() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      ResultList<McpServer> expected = new ResultList<>(Collections.emptyList(), null, null, 0);
      doReturn(expected)
          .when(resource)
          .listInternal(
              any(UriInfo.class), any(SecurityContext.class), any(), any(), anyInt(), any(), any());

      ResultList<McpServer> result =
          resource.list(uriInfo, securityContext, null, 10, null, null, Include.NON_DELETED);

      assertNotNull(result);
    }
  }

  @Test
  void testGet() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      McpServer expected = new McpServer().withId(UUID.randomUUID()).withName("srv");
      doReturn(expected)
          .when(resource)
          .getInternal(
              any(UriInfo.class),
              any(SecurityContext.class),
              any(UUID.class),
              any(),
              any(Include.class),
              any());

      McpServer result =
          resource.get(
              uriInfo, securityContext, UUID.randomUUID(), null, Include.NON_DELETED, null);

      assertNotNull(result);
    }
  }

  @Test
  void testGetByName() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      McpServer expected = new McpServer().withId(UUID.randomUUID()).withName("srv");
      doReturn(expected)
          .when(resource)
          .getByNameInternal(
              any(UriInfo.class),
              any(SecurityContext.class),
              anyString(),
              any(),
              any(Include.class),
              any());

      McpServer result =
          resource.getByName(uriInfo, "srv", securityContext, null, Include.NON_DELETED, null);

      assertNotNull(result);
    }
  }

  @Test
  void testListVersions() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = createResource(entityMock, mockRepo, mockAuth, mockLimits);

      UUID id = UUID.randomUUID();
      EntityHistory expected = new EntityHistory().withVersions(Collections.emptyList());
      when(mockRepo.listVersions(id)).thenReturn(expected);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);

      EntityHistory result = resource.listVersions(uriInfo, securityContext, id);

      assertNotNull(result);
    }
  }

  @Test
  void testGetVersion() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      McpServer expected = new McpServer().withId(UUID.randomUUID()).withName("srv");
      doReturn(expected)
          .when(resource)
          .getVersionInternal(any(SecurityContext.class), any(UUID.class), anyString());

      McpServer result = resource.getVersion(uriInfo, securityContext, UUID.randomUUID(), "0.1");

      assertNotNull(result);
    }
  }

  @Test
  void testCreate() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      Principal principal = mock(Principal.class);
      when(securityContext.getUserPrincipal()).thenReturn(principal);
      when(principal.getName()).thenReturn("admin");
      Response expected = Response.ok(new McpServer()).build();
      doReturn(expected)
          .when(resource)
          .create(any(UriInfo.class), any(SecurityContext.class), any(McpServer.class));

      CreateMcpServer createRequest = new CreateMcpServer().withName("srv");
      Response result = resource.create(uriInfo, securityContext, createRequest);

      assertNotNull(result);
    }
  }

  @Test
  void testCreateOrUpdate() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      Principal principal = mock(Principal.class);
      when(securityContext.getUserPrincipal()).thenReturn(principal);
      when(principal.getName()).thenReturn("admin");
      Response expected = Response.ok(new McpServer()).build();
      doReturn(expected)
          .when(resource)
          .createOrUpdate(any(UriInfo.class), any(SecurityContext.class), any(McpServer.class));

      CreateMcpServer createRequest = new CreateMcpServer().withName("srv");
      Response result = resource.createOrUpdate(uriInfo, securityContext, createRequest);

      assertNotNull(result);
    }
  }

  @Test
  void testDeleteById() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      Response expected = Response.ok().build();
      doReturn(expected)
          .when(resource)
          .delete(
              any(UriInfo.class),
              any(SecurityContext.class),
              any(UUID.class),
              anyBoolean(),
              anyBoolean());

      Response result = resource.delete(uriInfo, securityContext, false, false, UUID.randomUUID());

      assertNotNull(result);
    }
  }

  @Test
  void testDeleteByName() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      Response expected = Response.ok().build();
      doReturn(expected)
          .when(resource)
          .deleteByName(
              any(UriInfo.class),
              any(SecurityContext.class),
              anyString(),
              anyBoolean(),
              anyBoolean());

      Response result = resource.delete(uriInfo, securityContext, false, false, "srv");

      assertNotNull(result);
    }
  }

  @Test
  void testDeleteByIdAsync() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      Response expected = Response.ok().build();
      doReturn(expected)
          .when(resource)
          .deleteByIdAsync(
              any(UriInfo.class),
              any(SecurityContext.class),
              any(UUID.class),
              anyBoolean(),
              anyBoolean());

      Response result =
          resource.deleteByIdAsync(uriInfo, securityContext, false, false, UUID.randomUUID());

      assertNotNull(result);
    }
  }

  @Test
  void testRestoreMcpServer() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository mockRepo = mock(McpServerRepository.class);
      when(mockRepo.getAllowedFields()).thenReturn(new HashSet<>());
      Authorizer mockAuth = mock(Authorizer.class);
      Limits mockLimits = mock(Limits.class);
      McpServerResource resource = spy(createResource(entityMock, mockRepo, mockAuth, mockLimits));

      UriInfo uriInfo = mock(UriInfo.class);
      SecurityContext securityContext = mock(SecurityContext.class);
      Response expected = Response.ok().build();
      doReturn(expected)
          .when(resource)
          .restoreEntity(any(UriInfo.class), any(SecurityContext.class), any(UUID.class));

      UUID id = UUID.randomUUID();
      RestoreEntity restore = new RestoreEntity().withId(id);
      Response result = resource.restoreMcpServer(uriInfo, securityContext, restore);

      assertNotNull(result);
    }
  }
}
