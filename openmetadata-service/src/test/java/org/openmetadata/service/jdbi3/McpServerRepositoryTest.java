package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.Env;
import org.openmetadata.schema.entity.ai.McpConnectionConfig;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
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

      Field supportsSearchField = EntityRepository.class.getDeclaredField("supportsSearch");
      supportsSearchField.setAccessible(true);
      assertTrue((boolean) supportsSearchField.get(repo));
    }
  }

  @Test
  void testClearFieldsMasksStoredConnectionCredentials() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer server =
          new McpServer()
              .withId(UUID.randomUUID())
              .withName("s1")
              .withConnectionConfig(connectionWithCredentials());
      Fields fields = Fields.EMPTY_FIELDS;

      repo.clearFields(server, fields);

      assertMaskedConnection(server.getConnectionConfig());
    }
  }

  @Test
  void testPrepareWithoutConnectionConfig() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer server = new McpServer().withId(UUID.randomUUID()).withName("s1");

      assertDoesNotThrow(() -> repo.prepare(server, false));
      assertDoesNotThrow(() -> repo.prepare(server, true));
      assertNull(server.getConnectionConfig());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void testPrepareMasksConnectionCredentials(boolean update) {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      final McpServerRepository repo = createRepo(entityMock);
      final McpServer server =
          new McpServer().withName("credentials").withConnectionConfig(connectionWithCredentials());

      repo.prepare(server, update);
      assertMaskedConnection(server.getConnectionConfig());
      repo.prepare(server, update);
      assertMaskedConnection(server.getConnectionConfig());
    }
  }

  @Test
  void testPreparePreservesEmptyConnectionConfig() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      final McpServerRepository repo = createRepo(entityMock);
      final McpConnectionConfig config = new McpConnectionConfig().withEnv(new Env());
      final McpServer server = new McpServer().withName("empty").withConnectionConfig(config);

      repo.prepare(server, false);

      assertTrue(server.getConnectionConfig().getArgs().isEmpty());
      assertTrue(server.getConnectionConfig().getEnv().getAdditionalProperties().isEmpty());
      assertNull(server.getConnectionConfig().getUrl());
    }
  }

  @Test
  void testPreparePreservesAbsentConnectionFields() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      final McpServerRepository repo = createRepo(entityMock);
      final McpServer server =
          new McpServer()
              .withName("absent")
              .withConnectionConfig(new McpConnectionConfig().withArgs(null));

      repo.prepare(server, false);

      assertNull(server.getConnectionConfig().getArgs());
      assertNull(server.getConnectionConfig().getEnv());
      assertNull(server.getConnectionConfig().getUrl());
    }
  }

  private static McpConnectionConfig connectionWithCredentials() {
    return new McpConnectionConfig()
        .withCommand("npx")
        .withArgs(
            List.of("--token=argument-secret", "postgresql://user:database-secret@localhost/db"))
        .withEnv(
            new Env()
                .withAdditionalProperty("DATABASE_PASSWORD", "environment-secret")
                .withAdditionalProperty("CUSTOM_SETTING", "unrecognised-secret"))
        .withUrl("https://user:url-secret@example.com/mcp?api_key=query-secret")
        .withWorkingDirectory("/opt/mcp")
        .withTimeout(3000)
        .withRetryAttempts(2);
  }

  private static void assertMaskedConnection(McpConnectionConfig config) {
    assertEquals(List.of(PASSWORD_MASK, PASSWORD_MASK), config.getArgs());
    assertEquals(
        Map.of("DATABASE_PASSWORD", PASSWORD_MASK, "CUSTOM_SETTING", PASSWORD_MASK),
        config.getEnv().getAdditionalProperties());
    assertEquals(PASSWORD_MASK, config.getUrl());
    assertEquals("npx", config.getCommand());
    assertEquals("/opt/mcp", config.getWorkingDirectory());
    assertEquals(3000, config.getTimeout());
    assertEquals(2, config.getRetryAttempts());
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
  void testGetUpdaterMasksBothLegacyConnectionsBeforeRecordingChanges() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      final McpServerRepository repo = createRepo(entityMock);
      final McpServer original =
          mcpServerForConsolidation().withConnectionConfig(connectionWithCredentials());
      final McpServer updated =
          mcpServerForConsolidation()
              .withConnectionConfig(connectionWithCredentials().withTimeout(4000));
      final EntityRepository<McpServer>.EntityUpdater updater =
          repo.getUpdater(original, updated, EntityRepository.Operation.SOFT_DELETE, null);
      assertMaskedConnection(original.getConnectionConfig());
      assertEquals(
          original.getConnectionConfig().getArgs(), updated.getConnectionConfig().getArgs());
      assertEquals(original.getConnectionConfig().getEnv(), updated.getConnectionConfig().getEnv());
      assertEquals(PASSWORD_MASK, updated.getConnectionConfig().getUrl());
      assertEquals(4000, updated.getConnectionConfig().getTimeout());

      updater.changeDescription = new ChangeDescription();
      updater.entitySpecificUpdate(false);

      assertEquals(
          "connectionConfig", updater.changeDescription.getFieldsUpdated().getFirst().getName());
      assertFalse(JsonUtils.pojoToJson(updater.changeDescription).contains("-secret"));
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

  @Test
  void testConsolidateChangesSkipsVersionedEntityWithMissingChangeDescription() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      McpServer original = mcpServerForConsolidation().withChangeDescription(null);
      McpServer updated = mcpServerForConsolidation().withUpdatedAt(original.getUpdatedAt() + 1);
      McpServerRepository.McpServerUpdater updater =
          repo.new McpServerUpdater(original, updated, EntityRepository.Operation.PATCH);

      assertFalse(updater.consolidateChanges(original, updated, EntityRepository.Operation.PATCH));
    }
  }

  @Test
  void testConsolidateChangesSkipsVersionedEntityWithMissingPreviousVersion() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      McpServerRepository repo = createRepo(entityMock);
      ChangeDescription changeDescription = new ChangeDescription().withPreviousVersion(null);
      McpServer original = mcpServerForConsolidation().withChangeDescription(changeDescription);
      McpServer updated = mcpServerForConsolidation().withUpdatedAt(original.getUpdatedAt() + 1);
      McpServerRepository.McpServerUpdater updater =
          repo.new McpServerUpdater(original, updated, EntityRepository.Operation.PATCH);

      assertFalse(updater.consolidateChanges(original, updated, EntityRepository.Operation.PATCH));
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
