package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class McpExecutionContextTest {

  @Test
  void testContextReturnsExpectedDefaults() {
    McpExecutionContext context = McpExecutionContext.builder().build();

    assertEquals(Entity.MCP_EXECUTION, context.getResource());
    assertNull(context.getOwners());
    assertNull(context.getTags());
    assertNull(context.getEntity());
    assertNull(context.getDomains());
  }
}
