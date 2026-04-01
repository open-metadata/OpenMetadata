package org.openmetadata.service.resources.services.mcp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.CreateMcpService;
import org.openmetadata.schema.entity.services.McpService;

class McpServiceMapperTest {

  private final McpServiceMapper mapper = new McpServiceMapper();

  @Test
  void testCreateToEntityMapsAllFields() {
    CreateMcpService create =
        new CreateMcpService()
            .withName("test-mcp-service")
            .withDescription("Test MCP service")
            .withServiceType(CreateMcpService.McpServiceType.Mcp);

    McpService entity = mapper.createToEntity(create, "admin");

    assertNotNull(entity.getId());
    assertEquals("test-mcp-service", entity.getName());
    assertEquals("Test MCP service", entity.getDescription());
    assertNotNull(entity.getServiceType());
    assertEquals("admin", entity.getUpdatedBy());
  }
}
