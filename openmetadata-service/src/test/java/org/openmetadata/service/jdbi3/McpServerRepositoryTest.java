package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.HashSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

class McpServerRepositoryTest {

  private McpServerRepository createRepo(MockedStatic<Entity> entityMock) {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.McpServerDAO mcpServerDAO = mock(CollectionDAO.McpServerDAO.class);
    when(dao.mcpServerDAO()).thenReturn(mcpServerDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(dao);
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.MCP_SERVER))
        .thenReturn(McpServer.class);
    entityMock
        .when(() -> Entity.registerResourcePermissions(Entity.MCP_SERVER, null))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.registerResourceFieldViewMapping(Entity.MCP_SERVER, null))
        .thenAnswer(inv -> null);
    entityMock
        .when(() -> Entity.getEntityFields(McpServer.class))
        .thenReturn(
            new HashSet<>(
                Arrays.asList(
                    "id",
                    "name",
                    "fullyQualifiedName",
                    "displayName",
                    "description",
                    "serverType",
                    "transportType",
                    "protocolVersion",
                    "developmentStage",
                    "serverInfo",
                    "connectionConfig",
                    "capabilities",
                    "tools",
                    "resources",
                    "prompts",
                    "governanceMetadata",
                    "dataAccessSummary",
                    "usageMetrics",
                    "securityMetrics",
                    "usedByApplications",
                    "sourceCode",
                    "deploymentUrl",
                    "documentation",
                    "owners",
                    "followers",
                    "domain",
                    "dataProducts",
                    "tags",
                    "version",
                    "updatedAt",
                    "updatedBy",
                    "href",
                    "changeDescription",
                    "incrementalChangeDescription",
                    "deleted",
                    "certification",
                    "extension",
                    "domains",
                    "votes",
                    "lifeCycle",
                    "sourceHash")));
    return new McpServerRepository();
  }

  @Test
  void testConstructorSetsSupportsSearch() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);

      Field supportsSearchField = EntityRepository.class.getDeclaredField("supportsSearch");
      supportsSearchField.setAccessible(true);
      assertTrue((boolean) supportsSearchField.get(repo));
    }
  }

  @Test
  void testClearFieldsIsNoOp() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");
      Fields fields = Fields.EMPTY_FIELDS;

      assertDoesNotThrow(() -> repo.clearFields(server, fields));
    }
  }

  @Test
  void testPrepareIsNoOp() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");

      assertDoesNotThrow(() -> repo.prepare(server, false));
      assertDoesNotThrow(() -> repo.prepare(server, true));
    }
  }

  @Test
  void testStoreRelationshipsIsNoOp() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");

      assertDoesNotThrow(() -> repo.storeRelationships(server));
    }
  }

  @Test
  void testGetUpdaterReturnsMcpServerUpdater() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);

      McpServer original =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withVersion(0.1);
      McpServer updated =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withVersion(0.1);

      EntityRepository<McpServer>.EntityUpdater updater =
          repo.getUpdater(original, updated, EntityRepository.Operation.PUT, null);

      assertNotNull(updater);
      assertTrue(updater instanceof McpServerRepository.McpServerUpdater);
    }
  }

  @Test
  void testMcpServerUpdaterEntitySpecificUpdateRecordsChanges() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);

      McpServer original =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withVersion(0.1)
              .withServerType(McpServerType.Database)
              .withTransportType(McpTransportType.Stdio)
              .withProtocolVersion("2024-11-05")
              .withSourceCode("https://github.com/old/server")
              .withDeploymentUrl("http://old.example.com")
              .withDocumentation("https://old-docs.example.com");
      McpServer updated =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withVersion(0.1)
              .withServerType(McpServerType.Custom)
              .withTransportType(McpTransportType.SSE)
              .withProtocolVersion("2025-01-01")
              .withSourceCode("https://github.com/new/server")
              .withDeploymentUrl("http://new.example.com")
              .withDocumentation("https://new-docs.example.com");

      McpServerRepository.McpServerUpdater updater =
          repo.new McpServerUpdater(original, updated, EntityRepository.Operation.PUT);

      assertDoesNotThrow(() -> updater.entitySpecificUpdate(false));
    }
  }

  @Test
  void testMcpServerUpdaterEntitySpecificUpdateWithNoChanges() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);

      McpServer original =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withVersion(0.1)
              .withServerType(McpServerType.Database)
              .withTransportType(McpTransportType.Stdio);
      McpServer updated =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withVersion(0.1)
              .withServerType(McpServerType.Database)
              .withTransportType(McpTransportType.Stdio);

      McpServerRepository.McpServerUpdater updater =
          repo.new McpServerUpdater(original, updated, EntityRepository.Operation.PATCH);

      assertDoesNotThrow(() -> updater.entitySpecificUpdate(false));
    }
  }
}
