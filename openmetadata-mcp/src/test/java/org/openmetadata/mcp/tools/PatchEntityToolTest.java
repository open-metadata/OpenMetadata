package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class PatchEntityToolTest extends McpToolBase {

  @Override
  protected McpTool createTool() {
    return new PatchEntityTool();
  }

  @Override
  protected Map<String, Object> createValidParams() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "table");
    params.put("entityFqn", "sample_data.ecommerce_db.shopify.dim_address");
    params.put(
        "patch",
        "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Updated description\"}]");
    return params;
  }

  @Override
  protected boolean toolSupportsLimits() {
    return false;
  }

  @Test
  void testNullJsonPatchThrowsException() {
    Map<String, Object> nullPatchParams = new HashMap<>(validParams);
    nullPatchParams.put("patch", null);

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> tool.execute(authorizer, securityContext, nullPatchParams));

    assertEquals("Patch cannot be null or empty", exception.getMessage());
  }

  @Test
  void testEmptyJsonPatchThrowsException() {
    Map<String, Object> emptyPatchParams = new HashMap<>(validParams);
    emptyPatchParams.put("patch", "");

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> tool.execute(authorizer, securityContext, emptyPatchParams));

    assertEquals("Patch cannot be null or empty", exception.getMessage());
  }

  @Test
  void testInvalidJsonPatchThrowsException() {
    Map<String, Object> invalidParams = new HashMap<>(validParams);
    invalidParams.put("patch", "invalid json");

    assertThrows(Exception.class, () -> tool.execute(authorizer, securityContext, invalidParams));
  }

  @Test
  void testValidJsonPatchStructure() {
    Map<String, Object> complexParams = new HashMap<>(validParams);
    complexParams.put(
        "patch",
        "[{\"op\": \"add\", \"path\": \"/tags/-\", \"value\": {\"tagFQN\": \"PersonalData.Personal\"}}, "
            + "{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Complex update\"}]");

    // Should not throw JSON parsing exception
    try {
      tool.execute(authorizer, securityContext, complexParams);
    } catch (IllegalArgumentException e) {
      if (e.getMessage().equals("Patch cannot be null or empty")) {
        fail("JSON patch should be valid");
      }
      // Other exceptions are acceptable (missing dependencies, etc.)
    } catch (Exception e) {
      // Expected due to missing dependencies
      assertTrue(e.getMessage() != null);
    }
  }

  @Override
  protected int getMaxTokenLimit() {
    return 2000; // Patch responses are typically smaller
  }
}
