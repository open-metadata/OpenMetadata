package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.ai.McpExecution;
import org.openmetadata.schema.entity.ai.McpExecutionStatus;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

class McpExecutionIndexTest {

  @Test
  void testBuildSearchIndexDocWithServerId() {
    UUID serverId = UUID.randomUUID();
    McpExecution execution =
        new McpExecution()
            .withId(UUID.randomUUID())
            .withServerId(serverId)
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpExecutionIndex index = new McpExecutionIndex(execution);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertEquals(execution.getTimestamp(), result.get("@timestamp"));
    assertEquals(serverId.toString(), result.get("serverId"));
  }

  @Test
  void testBuildSearchIndexDocWithNullServerId() {
    McpExecution execution =
        new McpExecution()
            .withId(UUID.randomUUID())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Running);

    McpExecutionIndex index = new McpExecutionIndex(execution);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertEquals(execution.getTimestamp(), result.get("@timestamp"));
    assertNull(result.get("serverId"));
  }

  @Test
  void testBuildSearchIndexDocWithServerReference() {
    UUID serverId = UUID.randomUUID();
    EntityReference serverRef =
        new EntityReference().withId(serverId).withType(Entity.MCP_SERVER).withName("test-server");

    McpExecution execution =
        new McpExecution()
            .withId(UUID.randomUUID())
            .withServerId(serverId)
            .withServer(serverRef)
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpServer mockServer =
        new McpServer()
            .withId(serverId)
            .withName("test-server")
            .withFullyQualifiedName("test-server")
            .withDisplayName("Test Server")
            .withDescription("A test server")
            .withDeleted(false)
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(any(EntityReference.class), anyString(), eq(Include.ALL)))
          .thenReturn(mockServer);

      McpExecutionIndex index = new McpExecutionIndex(execution);
      Map<String, Object> doc = new HashMap<>();
      Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

      assertNotNull(result.get("server"));
      McpServer serverDoc = (McpServer) result.get("server");
      assertEquals("test-server", serverDoc.getName());
      assertEquals(McpServerType.Database, serverDoc.getServerType());
    }
  }

  @Test
  void testBuildSearchIndexDocWhenServerNotFoundInDb() {
    UUID serverId = UUID.randomUUID();
    EntityReference serverRef =
        new EntityReference()
            .withId(serverId)
            .withType(Entity.MCP_SERVER)
            .withName("deleted-server");

    McpExecution execution =
        new McpExecution()
            .withId(UUID.randomUUID())
            .withServerId(serverId)
            .withServer(serverRef)
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(any(EntityReference.class), anyString(), eq(Include.ALL)))
          .thenReturn(null);

      McpExecutionIndex index = new McpExecutionIndex(execution);
      Map<String, Object> doc = new HashMap<>();
      Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

      assertNull(result.get("server"));
    }
  }

  @Test
  void testBuildSearchIndexDocWithNullServerRef() {
    McpExecution execution =
        new McpExecution()
            .withId(UUID.randomUUID())
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Failed);

    McpExecutionIndex index = new McpExecutionIndex(execution);
    Map<String, Object> doc = new HashMap<>();
    Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

    assertNull(result.get("server"));
  }

  @Test
  void testBuildSearchIndexDocDenormalizesServerDomain() {
    UUID serverId = UUID.randomUUID();
    EntityReference serverRef =
        new EntityReference()
            .withId(serverId)
            .withType(Entity.MCP_SERVER)
            .withName("domain-server");

    EntityReference domainRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withName("engineering");

    McpExecution execution =
        new McpExecution()
            .withId(UUID.randomUUID())
            .withServerId(serverId)
            .withServer(serverRef)
            .withTimestamp(System.currentTimeMillis())
            .withStatus(McpExecutionStatus.Success);

    McpServer mockServer =
        new McpServer()
            .withId(serverId)
            .withName("domain-server")
            .withFullyQualifiedName("domain-server")
            .withDeleted(false)
            .withDomain(domainRef)
            .withServerType(McpServerType.Custom)
            .withTransportType(McpTransportType.SSE);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityOrNull(any(EntityReference.class), anyString(), eq(Include.ALL)))
          .thenReturn(mockServer);

      McpExecutionIndex index = new McpExecutionIndex(execution);
      Map<String, Object> doc = new HashMap<>();
      Map<String, Object> result = index.buildSearchIndexDocInternal(doc);

      assertNotNull(result.get("domain"));
      EntityReference domain = (EntityReference) result.get("domain");
      assertEquals("engineering", domain.getName());
    }
  }

  @Test
  void testGetEntityReturnsExecution() {
    McpExecution execution = new McpExecution().withId(UUID.randomUUID());
    McpExecutionIndex index = new McpExecutionIndex(execution);
    assertEquals(execution, index.getEntity());
  }

  @Test
  void testGetFieldsReturnsExpectedBoosts() {
    Map<String, Float> fields = McpExecutionIndex.getFields();
    assertEquals(10.0f, fields.get("server.name"));
    assertEquals(15.0f, fields.get("server.displayName"));
    assertEquals(10.0f, fields.get("server.fullyQualifiedName"));
    assertEquals(5.0f, fields.get("status"));
    assertEquals(5.0f, fields.get("executedBy"));
  }
}
