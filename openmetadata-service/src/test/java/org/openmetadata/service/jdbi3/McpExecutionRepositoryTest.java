package org.openmetadata.service.jdbi3;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class McpExecutionRepositoryTest {

  private TestMcpExecutionRepository createRepo(
      MockedStatic<Entity> entityMock, CollectionDAO.McpExecutionDAO mockDao) {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.mcpExecutionDAO()).thenReturn(mockDao);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.MCP_EXECUTION))
        .thenReturn(McpExecution.class);
    entityMock
        .when(() -> Entity.registerTimeSeriesResourcePermissions(Entity.MCP_EXECUTION))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.getEntityFields(McpExecution.class))
        .thenReturn(
            new HashSet<>(
                Arrays.asList(
                    "id",
                    "server",
                    "serverId",
                    "timestamp",
                    "endTimestamp",
                    "durationMs",
                    "status",
                    "executedBy",
                    "applicationContext",
                    "sessionId",
                    "toolCalls",
                    "resourceAccesses",
                    "promptUses",
                    "dataAccessed",
                    "complianceChecks",
                    "metrics",
                    "errorMessage",
                    "errorStack",
                    "environment",
                    "serverVersion",
                    "protocolVersion",
                    "metadata",
                    "deleted")));
    return new TestMcpExecutionRepository();
  }

  @Test
  void testStoreRelationshipSkipsWhenServerRefIsNull() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      CollectionDAO.McpExecutionDAO mockDao = mock(CollectionDAO.McpExecutionDAO.class);
      when(mockDao.getTimeSeriesTableName()).thenReturn("mcp_execution_entity");
      TestMcpExecutionRepository repo = createRepo(entityMock, mockDao);

      McpExecution execution = new McpExecution().withId(UUID.randomUUID()).withServer(null);

      CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
      CollectionDAO dao2 = mock(CollectionDAO.class);
      when(dao2.relationshipDAO()).thenReturn(relDAO);
      when(dao2.mcpExecutionDAO()).thenReturn(mockDao);
      entityMock.when(Entity::getCollectionDAO).thenReturn(dao2);

      repo.callStoreRelationship(execution);

      verify(relDAO, never())
          .insert(
              any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
    }
  }

  @Test
  void testStoreRelationshipSkipsWhenServerIdIsNull() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      CollectionDAO.McpExecutionDAO mockDao = mock(CollectionDAO.McpExecutionDAO.class);
      when(mockDao.getTimeSeriesTableName()).thenReturn("mcp_execution_entity");
      TestMcpExecutionRepository repo = createRepo(entityMock, mockDao);

      EntityReference serverRef = new EntityReference().withId(null);
      McpExecution execution = new McpExecution().withId(UUID.randomUUID()).withServer(serverRef);

      CollectionDAO.EntityRelationshipDAO relDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
      CollectionDAO dao2 = mock(CollectionDAO.class);
      when(dao2.relationshipDAO()).thenReturn(relDAO);
      when(dao2.mcpExecutionDAO()).thenReturn(mockDao);
      entityMock.when(Entity::getCollectionDAO).thenReturn(dao2);

      repo.callStoreRelationship(execution);

      verify(relDAO, never())
          .insert(
              any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
    }
  }

  @Test
  void testDeleteExecutionDataDelegatesToDao() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      CollectionDAO.McpExecutionDAO mockDao = mock(CollectionDAO.McpExecutionDAO.class);
      when(mockDao.getTimeSeriesTableName()).thenReturn("mcp_execution_entity");
      TestMcpExecutionRepository repo = createRepo(entityMock, mockDao);

      UUID serverId = UUID.randomUUID();
      Long timestamp = 1000L;

      repo.deleteExecutionData(serverId, timestamp);

      verify(mockDao).deleteAtTimestamp(serverId.toString(), null, timestamp);
    }
  }

  @Test
  void testDeleteByServerIdDelegatesToDao() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      CollectionDAO.McpExecutionDAO mockDao = mock(CollectionDAO.McpExecutionDAO.class);
      when(mockDao.getTimeSeriesTableName()).thenReturn("mcp_execution_entity");
      TestMcpExecutionRepository repo = createRepo(entityMock, mockDao);

      UUID serverId = UUID.randomUUID();

      repo.deleteByServerId(serverId);

      verify(mockDao).deleteByServerId("mcp_execution_entity", serverId.toString());
    }
  }

  /** Subclass exposing protected storeRelationship for testing. */
  static class TestMcpExecutionRepository
      extends org.openmetadata.service.jdbi3.McpExecutionRepository {
    void callStoreRelationship(McpExecution execution) {
      storeRelationship(execution);
    }
  }
}
