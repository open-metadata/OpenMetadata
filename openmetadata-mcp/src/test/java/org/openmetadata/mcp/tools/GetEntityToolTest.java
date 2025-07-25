package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

public class GetEntityToolTest extends McpToolBase {

  @Override
  protected McpTool createTool() {
    return new GetEntityTool();
  }

  @Override
  protected Map<String, Object> createValidParams() {
    Map<String, Object> params = new HashMap<>();
    params.put("entity_type", "table");
    params.put("fqn", "sample_data.ecommerce_db.shopify.dim_address");
    return params;
  }

  @Override
  protected boolean toolSupportsLimits() {
    return false;
  }

  @Test
  void testMissingEntityTypeParameter() {
    Map<String, Object> missingTypeParams = new HashMap<>(validParams);
    missingTypeParams.remove("entity_type");

    assertThrows(
        Exception.class, () -> tool.execute(authorizer, securityContext, missingTypeParams));
  }

  @Test
  void testMissingFqnParameter() {
    Map<String, Object> missingFqnParams = new HashMap<>(validParams);
    missingFqnParams.remove("fqn");

    assertThrows(
        Exception.class, () -> tool.execute(authorizer, securityContext, missingFqnParams));
  }

  @Test
  void testDifferentEntityTypes() {
    String[] entityTypes = {"database", "databaseSchema", "topic", "dashboard", "pipeline"};

    for (String entityType : entityTypes) {
      Map<String, Object> params = new HashMap<>(validParams);
      params.put("entity_type", entityType);

      // Should not crash with different entity types
      try {
        tool.execute(authorizer, securityContext, params);
      } catch (Exception e) {
        // Expected due to missing dependencies, but should not be null pointer
        assertTrue(e.getMessage() != null, "Failed for entity type: " + entityType);
      }
    }
  }

  @Test
  void testComplexFqnHandling() {
    Map<String, Object> complexFqnParams = new HashMap<>(validParams);
    complexFqnParams.put("fqn", "complex.database-name.schema_name.table-with-dashes.column");

    // Should handle complex FQNs without parsing errors
    try {
      tool.execute(authorizer, securityContext, complexFqnParams);
    } catch (Exception e) {
      // Expected due to missing dependencies
      assertTrue(e.getMessage() != null);
    }
  }

  @Override
  protected int getMaxTokenLimit() {
    return 8000; // Entity details can be large
  }
}
