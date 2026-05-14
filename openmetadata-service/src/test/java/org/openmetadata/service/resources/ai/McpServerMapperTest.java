package org.openmetadata.service.resources.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.ai.CreateMcpServer;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.ai.McpServerType;
import org.openmetadata.schema.entity.ai.McpTransportType;

class McpServerMapperTest {

  private final McpServerMapper mapper = new McpServerMapper();

  @Test
  void testCreateToEntityMapsAllFields() {
    CreateMcpServer create =
        new CreateMcpServer()
            .withName("test-server")
            .withDescription("Test MCP server")
            .withServerType(McpServerType.Database)
            .withTransportType(McpTransportType.Stdio)
            .withProtocolVersion("2024-11-05")
            .withSourceCode("https://github.com/example/server")
            .withDeploymentUrl("http://localhost:8080")
            .withDocumentation("https://docs.example.com");

    McpServer entity = mapper.createToEntity(create, "admin");

    assertNotNull(entity.getId());
    assertEquals("test-server", entity.getName());
    assertEquals("Test MCP server", entity.getDescription());
    assertEquals(McpServerType.Database, entity.getServerType());
    assertEquals(McpTransportType.Stdio, entity.getTransportType());
    assertEquals("2024-11-05", entity.getProtocolVersion());
    assertEquals("https://github.com/example/server", entity.getSourceCode());
    assertEquals("http://localhost:8080", entity.getDeploymentUrl());
    assertEquals("https://docs.example.com", entity.getDocumentation());
    assertEquals("admin", entity.getUpdatedBy());
  }

  @Test
  void testCreateToEntityWithMinimalFields() {
    CreateMcpServer create =
        new CreateMcpServer().withName("minimal-server").withServerType(McpServerType.Custom);

    McpServer entity = mapper.createToEntity(create, "user1");

    assertNotNull(entity.getId());
    assertEquals("minimal-server", entity.getName());
    assertEquals(McpServerType.Custom, entity.getServerType());
  }
}
