package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdater;
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
                    "reviewers",
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
      assertTrue(repo.context().options().isSupportsSearch());
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
  void testGetUpdaterAppliesMcpServerFields() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer original =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withUpdatedAt(10L)
              .withVersion(0.1);
      McpServer updated =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withUpdatedAt(10L)
              .withVersion(0.1);
      EntityUpdater<McpServer> updater =
          repo.getUpdater(original, updated, EntityOperation.PUT, null);
      updated.setProtocolVersion("2025-01-01");
      updater.setPatchedFields(Set.of("protocolVersion"));
      updater.updateWithDeferredStore();
      assertEquals(original.getId(), updated.getId());
      assertEquals(0.2, updated.getVersion());
      assertEquals(
          "protocolVersion",
          updater.getIncrementalChangeDescription().getFieldsAdded().getFirst().getName());
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
              .withUpdatedAt(10L)
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
              .withUpdatedAt(10L)
              .withVersion(0.1)
              .withServerType(McpServerType.Custom)
              .withTransportType(McpTransportType.SSE)
              .withProtocolVersion("2025-01-01")
              .withSourceCode("https://github.com/new/server")
              .withDeploymentUrl("http://new.example.com")
              .withDocumentation("https://new-docs.example.com");
      EntityUpdater<McpServer> updater =
          repo.getUpdater(original, updated, EntityOperation.PUT, null);
      Set<String> fields =
          Set.of(
              "serverType",
              "transportType",
              "protocolVersion",
              "sourceCode",
              "deploymentUrl",
              "documentation");
      updater.setPatchedFields(fields);
      updater.updateWithDeferredStore();
      assertEquals(0.2, updated.getVersion());
      assertEquals(
          fields,
          updater.getIncrementalChangeDescription().getFieldsUpdated().stream()
              .map(change -> change.getName())
              .collect(Collectors.toSet()));
      assertEquals("2025-01-01", updated.getProtocolVersion());
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
              .withUpdatedAt(10L)
              .withVersion(0.1)
              .withServerType(McpServerType.Database)
              .withTransportType(McpTransportType.Stdio);
      McpServer updated =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("server")
              .withFullyQualifiedName("server")
              .withUpdatedBy("admin")
              .withUpdatedAt(10L)
              .withVersion(0.1)
              .withServerType(McpServerType.Database)
              .withTransportType(McpTransportType.Stdio);
      EntityUpdater<McpServer> updater =
          repo.getUpdater(original, updated, EntityOperation.PATCH, null);
      updater.setPatchedFields(Set.of("serverType", "transportType"));
      updater.updateWithDeferredStore();
      assertFalse(updater.incrementalFieldsChanged());
      assertEquals(0.1, updated.getVersion());
    }
  }

  @Test
  void testConsolidateChangesSkipsVersionedEntityWithMissingChangeDescription() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer original = mcpServerForConsolidation().withChangeDescription(null);
      McpServer updated = mcpServerForConsolidation().withUpdatedAt(original.getUpdatedAt() + 1);
      EntityUpdater<McpServer> updater =
          repo.getUpdater(original, updated, EntityOperation.PATCH, null);
      assertFalse(updater.canConsolidateChanges());
    }
  }

  @Test
  void testConsolidateChangesSkipsVersionedEntityWithMissingPreviousVersion() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      ChangeDescription changeDescription = new ChangeDescription().withPreviousVersion(null);
      McpServer original = mcpServerForConsolidation().withChangeDescription(changeDescription);
      McpServer updated = mcpServerForConsolidation().withUpdatedAt(original.getUpdatedAt() + 1);
      EntityUpdater<McpServer> updater =
          repo.getUpdater(original, updated, EntityOperation.PATCH, null);
      assertFalse(updater.canConsolidateChanges());
    }
  }

  private static McpServer mcpServerForConsolidation() {
    long updatedAt = System.currentTimeMillis();
    return new McpServer()
        .withId(UUID.randomUUID())
        .withName("server")
        .withFullyQualifiedName("server")
        .withUpdatedBy("admin")
        .withUpdatedAt(updatedAt)
        .withVersion(1.1)
        .withDeleted(false);
  }
}
