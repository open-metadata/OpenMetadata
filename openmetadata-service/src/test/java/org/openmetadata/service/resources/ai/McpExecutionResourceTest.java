package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Field;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.McpExecutionRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

class McpExecutionResourceTest {

  private McpExecutionResource createResource(
      MockedStatic<Entity> entityMock, McpExecutionRepository mockRepo, Authorizer mockAuth) {
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.MCP_EXECUTION))
        .thenReturn(McpExecution.class);
    entityMock
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.MCP_EXECUTION))
        .thenReturn(mockRepo);
    entityMock
        .when(() -> Entity.registerTimeSeriesResourcePermissions(Entity.MCP_EXECUTION))
        .thenAnswer(inv -> null);
    return new McpExecutionResource(mockAuth);
  }

  /** Authorizer that refuses every authorization naming {@code deniedServerId} as the MCP server. */
  private static Authorizer authorizerRefusing(UUID deniedServerId) {
    Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            inv -> {
              ResourceContextInterface context = inv.getArgument(2);
              if (context instanceof ResourceContext<?> resourceContext) {
                EntityInterface<?> entity = resourceContext.getResolvedEntity();
                if (entity != null && deniedServerId.equals(entity.getId())) {
                  throw new AuthorizationException("denied");
                }
                if (deniedServerId.equals(idOf(resourceContext))) {
                  throw new AuthorizationException("denied");
                }
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    return authorizer;
  }

  private static UUID idOf(ResourceContext<?> context) {
    try {
      Field id = ResourceContext.class.getDeclaredField("id");
      id.setAccessible(true);
      return (UUID) id.get(context);
    } catch (ReflectiveOperationException e) {
      throw new IllegalStateException(e);
    }
  }

  @Test
  void testCollectionPathConstant() {
    assertEquals("/v1/mcpExecutions/", McpExecutionResource.COLLECTION_PATH);
  }

  @Test
  void testConstructorSetsFields() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      Field repoField =
          org.openmetadata.service.resources.EntityTimeSeriesResource.class.getDeclaredField(
              "repository");
      repoField.setAccessible(true);
      assertNotNull(repoField.get(resource));

      Field authField =
          org.openmetadata.service.resources.EntityTimeSeriesResource.class.getDeclaredField(
              "authorizer");
      authField.setAccessible(true);
      assertNotNull(authField.get(resource));
    }
  }

  @Test
  void testListWithTimestamps() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      ResultList<McpExecution> expected = new ResultList<>(Collections.emptyList(), null, null, 0);
      when(mockRepo.listWithOffset(
              any(), any(), anyInt(), anyLong(), anyLong(), anyBoolean(), anyBoolean()))
          .thenReturn(expected);

      ResultList<McpExecution> result = resource.list(securityContext, null, 1000L, 2000L, 10);

      assertNotNull(result);
    }
  }

  @Test
  void testListWithoutTimestamps() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      ResultList<McpExecution> expected = new ResultList<>(Collections.emptyList(), null, null, 0);
      when(mockRepo.listWithOffset(any(), any(), anyInt(), anyBoolean())).thenReturn(expected);

      ResultList<McpExecution> result = resource.list(securityContext, null, null, null, 10);

      assertNotNull(result);
    }
  }

  @Test
  void testListWithServerId() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      ResultList<McpExecution> expected = new ResultList<>(Collections.emptyList(), null, null, 0);
      when(mockRepo.listWithOffset(any(), any(), anyInt(), anyBoolean())).thenReturn(expected);

      UUID serverId = UUID.randomUUID();
      ResultList<McpExecution> result = resource.list(securityContext, serverId, null, null, 10);

      assertNotNull(result);
    }
  }

  @Test
  void testListRejectsPartialTimeRange() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      assertThrows(
          IllegalArgumentException.class,
          () -> resource.list(securityContext, null, 1000L, null, 10));
      assertThrows(
          IllegalArgumentException.class,
          () -> resource.list(securityContext, null, null, 2000L, 10));

      verifyNoInteractions(mockRepo);
    }
  }

  @Test
  void testGet() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      UUID id = UUID.randomUUID();
      McpExecution expected = new McpExecution().withId(id).withServerId(UUID.randomUUID());
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(expected);

      McpExecution result = resource.get(securityContext, id);

      assertNotNull(result);
      assertEquals(id, result.getId());
    }
  }

  @Test
  void testGetRefusedForDeniedServer() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      UUID deniedServerId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedServerId);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID id = UUID.randomUUID();
      McpExecution execution = new McpExecution().withId(id).withServerId(deniedServerId);
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      assertThrows(
          AuthorizationException.class, () -> resource.get(mock(SecurityContext.class), id));
    }
  }

  @Test
  void testCreate() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());

      UUID serverId = UUID.randomUUID();
      McpExecution mcpExecution =
          new McpExecution().withId(UUID.randomUUID()).withServerId(serverId);
      when(mockRepo.createNewRecord(any(McpExecution.class), anyString())).thenReturn(mcpExecution);

      Response result = resource.create(securityContext, mcpExecution);

      assertNotNull(result);
    }
  }

  @Test
  void testCreateRefusedForDeniedServer() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      UUID deniedServerId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedServerId);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      McpExecution mcpExecution =
          new McpExecution().withId(UUID.randomUUID()).withServerId(deniedServerId);

      assertThrows(
          AuthorizationException.class,
          () -> resource.create(mock(SecurityContext.class), mcpExecution));
      verify(mockRepo, never()).createNewRecord(any(), anyString());
    }
  }

  @Test
  void testDeleteMcpExecutionData() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());
      doNothing().when(mockRepo).deleteExecutionData(any(UUID.class), anyLong());

      UUID serverId = UUID.randomUUID();
      Long timestamp = 12345L;
      Response result = resource.deleteMcpExecutionData(securityContext, serverId, timestamp);

      assertNotNull(result);
      assertEquals(Response.Status.OK.getStatusCode(), result.getStatus());
      verify(mockRepo).deleteExecutionData(serverId, timestamp);
    }
  }

  @Test
  void testDeleteMcpExecutionDataRefusedForDeniedServer() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      UUID deniedServerId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedServerId);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      assertThrows(
          AuthorizationException.class,
          () ->
              resource.deleteMcpExecutionData(mock(SecurityContext.class), deniedServerId, 12345L));
      verify(mockRepo, never()).deleteExecutionData(any(), anyLong());
    }
  }

  @Test
  void testDelete() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doNothing().when(mockAuth).authorize(any(), any(), any());
      doNothing().when(mockRepo).deleteById(any(UUID.class), anyBoolean());

      UUID id = UUID.randomUUID();
      McpExecution execution = new McpExecution().withId(id).withServerId(UUID.randomUUID());
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      Response result = resource.delete(securityContext, id, false);

      assertNotNull(result);
      assertEquals(Response.Status.OK.getStatusCode(), result.getStatus());
      verify(mockRepo).deleteById(id, false);
    }
  }

  @Test
  void testDeleteRefusedForDeniedServer() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      UUID deniedServerId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedServerId);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID id = UUID.randomUUID();
      McpExecution execution = new McpExecution().withId(id).withServerId(deniedServerId);
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      assertThrows(
          AuthorizationException.class,
          () -> resource.delete(mock(SecurityContext.class), id, true));
      verify(mockRepo, never()).deleteById(any(), anyBoolean());
    }
  }

  @Test
  void testListFilteredToDeniedServerIsRefused() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      UUID deniedServerId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedServerId);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      assertThrows(
          AuthorizationException.class,
          () -> resource.list(mock(SecurityContext.class), deniedServerId, null, null, 10));
      verifyNoInteractions(mockRepo);
    }
  }

  @Test
  void testListDropsRecordsOfDeniedServer() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpExecutionRepository mockRepo = mock(McpExecutionRepository.class);
      @SuppressWarnings("unchecked")
      EntityRepository<McpServer> mockServerRepo = mock(EntityRepository.class);

      UUID deniedServerId = UUID.randomUUID();
      UUID allowedServerId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedServerId);
      McpExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      entityMock
          .when(() -> Entity.getEntityRepository(Entity.MCP_SERVER))
          .thenReturn(mockServerRepo);
      // getEntityReference() reads the canonical name map, normally populated by Entity's static
      // initializer, which the mocked static bypasses.
      EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("mcpserver", Entity.MCP_SERVER);
      when(mockServerRepo.get(any(), anyList(), any(), any()))
          .thenReturn(List.of(new McpServer().withId(allowedServerId)));

      McpExecution deniedRecord =
          new McpExecution().withId(UUID.randomUUID()).withServerId(deniedServerId);
      McpExecution allowedRecord =
          new McpExecution().withId(UUID.randomUUID()).withServerId(allowedServerId);
      when(mockRepo.listWithOffset(any(), any(), anyInt(), anyBoolean()))
          .thenReturn(new ResultList<>(List.of(deniedRecord, allowedRecord), null, null, 2));

      ResultList<McpExecution> result =
          resource.list(mock(SecurityContext.class), null, null, null, 10);

      assertEquals(1, result.getData().size());
      assertEquals(allowedRecord.getId(), result.getData().get(0).getId());
    }
  }
}
