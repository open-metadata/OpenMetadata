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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AgentExecution;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AgentExecutionRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.AgentExecutionContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

class AgentExecutionResourceTest {

  private AgentExecutionResource createResource(
      MockedStatic<Entity> entityMock, AgentExecutionRepository mockRepo, Authorizer mockAuth) {
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.AGENT_EXECUTION))
        .thenReturn(AgentExecution.class);
    entityMock
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.AGENT_EXECUTION))
        .thenReturn(mockRepo);
    entityMock
        .when(() -> Entity.registerTimeSeriesResourcePermissions(Entity.AGENT_EXECUTION))
        .thenAnswer(inv -> null);
    return new AgentExecutionResource(mockAuth);
  }

  /** Authorizer that refuses every authorization naming {@code deniedAgentId} as the AI application. */
  private static Authorizer authorizerRefusing(UUID deniedAgentId) {
    Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            inv -> {
              ResourceContextInterface context = inv.getArgument(2);
              if (context instanceof ResourceContext<?> resourceContext) {
                EntityInterface<?> entity = resourceContext.getResolvedEntity();
                if (entity != null && deniedAgentId.equals(entity.getId())) {
                  throw new AuthorizationException("denied");
                }
                if (deniedAgentId.equals(idOf(resourceContext))) {
                  throw new AuthorizationException("denied");
                }
              }
              return null;
            })
        .when(authorizer)
        .authorize(any(), any(), any());
    return authorizer;
  }

  /** Authorizer that refuses the type-level agentExecution check while allowing everything else. */
  private static Authorizer authorizerRefusingExecutionType() {
    Authorizer authorizer = mock(Authorizer.class);
    doAnswer(
            inv -> {
              if (inv.getArgument(2) instanceof AgentExecutionContext) {
                throw new AuthorizationException("denied");
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
    assertEquals("/v1/agentExecutions/", AgentExecutionResource.COLLECTION_PATH);
  }

  @Test
  void testConstructorSetsFields() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

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
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doAnswer(inv -> null).when(mockAuth).authorize(any(), any(), any());

      ResultList<AgentExecution> expected = new ResultList<>(List.of(), null, null, 0);
      when(mockRepo.listWithOffset(
              any(), any(), anyInt(), anyLong(), anyLong(), anyBoolean(), anyBoolean()))
          .thenReturn(expected);

      ResultList<AgentExecution> result = resource.list(securityContext, null, 1000L, 2000L, 10);

      assertNotNull(result);
    }
  }

  @Test
  void testListWithoutTimestamps() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doAnswer(inv -> null).when(mockAuth).authorize(any(), any(), any());

      ResultList<AgentExecution> expected = new ResultList<>(List.of(), null, null, 0);
      when(mockRepo.listWithOffset(any(), any(), anyInt(), anyBoolean())).thenReturn(expected);

      ResultList<AgentExecution> result = resource.list(securityContext, null, null, null, 10);

      assertNotNull(result);
    }
  }

  @Test
  void testGet() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doAnswer(inv -> null).when(mockAuth).authorize(any(), any(), any());

      UUID id = UUID.randomUUID();
      AgentExecution expected = new AgentExecution().withId(id).withAgentId(UUID.randomUUID());
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(expected);

      AgentExecution result = resource.get(securityContext, id);

      assertNotNull(result);
      assertEquals(id, result.getId());
    }
  }

  @Test
  void testGetRefusedForDeniedAgent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      UUID deniedAgentId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedAgentId);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID id = UUID.randomUUID();
      AgentExecution execution = new AgentExecution().withId(id).withAgentId(deniedAgentId);
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      assertThrows(
          AuthorizationException.class, () -> resource.get(mock(SecurityContext.class), id));
    }
  }

  @Test
  void testGetRefusedWhenExecutionTypeDenied() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = authorizerRefusingExecutionType();
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID id = UUID.randomUUID();
      AgentExecution execution = new AgentExecution().withId(id).withAgentId(UUID.randomUUID());
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      assertThrows(
          AuthorizationException.class, () -> resource.get(mock(SecurityContext.class), id));
    }
  }

  @Test
  void testCreate() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doAnswer(inv -> null).when(mockAuth).authorize(any(), any(), any());

      AgentExecution agentExecution =
          new AgentExecution().withId(UUID.randomUUID()).withAgentId(UUID.randomUUID());
      when(mockRepo.createNewRecord(any(AgentExecution.class), anyString()))
          .thenReturn(agentExecution);

      Response result = resource.create(securityContext, agentExecution);

      assertNotNull(result);
    }
  }

  @Test
  void testCreateRefusedForDeniedAgent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      UUID deniedAgentId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedAgentId);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      AgentExecution agentExecution =
          new AgentExecution().withId(UUID.randomUUID()).withAgentId(deniedAgentId);

      assertThrows(
          AuthorizationException.class,
          () -> resource.create(mock(SecurityContext.class), agentExecution));
      verify(mockRepo, never()).createNewRecord(any(), anyString());
    }
  }

  @Test
  void testDeleteAgentExecutionData() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doAnswer(inv -> null).when(mockAuth).authorize(any(), any(), any());
      doAnswer(inv -> null).when(mockRepo).deleteExecutionData(any(UUID.class), anyLong());

      UUID agentId = UUID.randomUUID();
      Long timestamp = 12345L;
      Response result = resource.deleteAgentExecutionData(securityContext, agentId, timestamp);

      assertNotNull(result);
      assertEquals(Response.Status.OK.getStatusCode(), result.getStatus());
      verify(mockRepo).deleteExecutionData(agentId, timestamp);
    }
  }

  @Test
  void testDeleteAgentExecutionDataRefusedForDeniedAgent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      UUID deniedAgentId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedAgentId);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      assertThrows(
          AuthorizationException.class,
          () ->
              resource.deleteAgentExecutionData(
                  mock(SecurityContext.class), deniedAgentId, 12345L));
      verify(mockRepo, never()).deleteExecutionData(any(), anyLong());
    }
  }

  @Test
  void testDelete() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      SecurityContext securityContext = mock(SecurityContext.class);
      doAnswer(inv -> null).when(mockAuth).authorize(any(), any(), any());
      doAnswer(inv -> null).when(mockRepo).deleteById(any(UUID.class), anyBoolean());

      UUID id = UUID.randomUUID();
      AgentExecution execution = new AgentExecution().withId(id).withAgentId(UUID.randomUUID());
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      Response result = resource.delete(securityContext, id, true);

      assertNotNull(result);
      assertEquals(Response.Status.OK.getStatusCode(), result.getStatus());
      verify(mockRepo).deleteById(id, true);
    }
  }

  @Test
  void testDeleteRefusedForDeniedAgent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      UUID deniedAgentId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedAgentId);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID id = UUID.randomUUID();
      AgentExecution execution = new AgentExecution().withId(id).withAgentId(deniedAgentId);
      when(mockRepo.getByIdOrNotFound(id)).thenReturn(execution);

      assertThrows(
          AuthorizationException.class,
          () -> resource.delete(mock(SecurityContext.class), id, true));
      verify(mockRepo, never()).deleteById(any(), anyBoolean());
    }
  }

  @Test
  void testListFilteredToDeniedAgentIsRefused() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      UUID deniedAgentId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedAgentId);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      assertThrows(
          AuthorizationException.class,
          () -> resource.list(mock(SecurityContext.class), deniedAgentId, null, null, 10));
      verifyNoInteractions(mockRepo);
    }
  }

  @Test
  void testListDropsRecordsOfDeniedAgent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      AgentExecutionRepository mockRepo = mock(AgentExecutionRepository.class);
      @SuppressWarnings("unchecked")
      EntityRepository<AIApplication> mockAgentRepo = mock(EntityRepository.class);

      UUID deniedAgentId = UUID.randomUUID();
      UUID allowedAgentId = UUID.randomUUID();
      Authorizer mockAuth = authorizerRefusing(deniedAgentId);
      AgentExecutionResource resource = createResource(entityMock, mockRepo, mockAuth);

      entityMock
          .when(() -> Entity.getEntityRepository(Entity.AI_APPLICATION))
          .thenReturn(mockAgentRepo);
      // getEntityReference() reads the canonical name map, normally populated by Entity's static
      // initializer, which the mocked static bypasses.
      EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("aiapplication", Entity.AI_APPLICATION);
      when(mockAgentRepo.get(any(), anyList(), any(), any()))
          .thenReturn(List.of(new AIApplication().withId(allowedAgentId)));

      AgentExecution deniedRecord =
          new AgentExecution().withId(UUID.randomUUID()).withAgentId(deniedAgentId);
      AgentExecution allowedRecord =
          new AgentExecution().withId(UUID.randomUUID()).withAgentId(allowedAgentId);
      when(mockRepo.listWithOffset(any(), any(), anyInt(), anyBoolean()))
          .thenReturn(new ResultList<>(List.of(deniedRecord, allowedRecord), null, null, 2));

      ResultList<AgentExecution> result =
          resource.list(mock(SecurityContext.class), null, null, null, 10);

      assertEquals(1, result.getData().size());
      assertEquals(allowedRecord.getId(), result.getData().get(0).getId());
    }
  }
}
