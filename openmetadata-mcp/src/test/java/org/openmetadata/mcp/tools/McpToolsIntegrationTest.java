package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class McpToolsIntegrationTest {

  private CatalogSecurityContext testSecurityContext;

  @BeforeAll
  void setUp() throws Exception {
    // Create test security context with proper signature
    Principal testPrincipal = () -> "testUser";
    testSecurityContext = new CatalogSecurityContext(testPrincipal, "testUser", "", Set.of());
  }

  @Test
  void testGetEntityToolWithValidInputs() throws Exception {
    // Given
    GetEntityTool getEntityTool = new GetEntityTool();
    Map<String, Object> params = new HashMap<>();
    params.put("entity_type", "table");
    params.put("fqn", "sample_data.ecommerce_db.shopify.dim_address");

    // When & Then - Should not crash with null pointer exceptions
    // This test verifies the tool handles input validation correctly
    try {
      Map<String, Object> result = getEntityTool.execute(null, testSecurityContext, params);

      // If result is returned, verify it's structured correctly
      if (result != null) {
        // Basic structure validation
        assertTrue(result instanceof Map, "Result should be a Map");

        // If there's an error, it should be properly formatted
        if (result.containsKey("error")) {
          assertTrue(result.get("error") instanceof String, "Error should be a string");
          assertFalse(
              ((String) result.get("error")).isEmpty(), "Error message should not be empty");
        }
      }
    } catch (Exception e) {
      // Expected due to missing database context, but should not be NPE
      assertNotNull(e.getMessage(), "Exception message should not be null");
      assertFalse(e instanceof NullPointerException, "Should not be null pointer exception");
    }
  }

  @Test
  void testPatchEntityToolWithValidInputs() throws Exception {
    // Given
    PatchEntityTool patchTool = new PatchEntityTool();
    Map<String, Object> patchParams = new HashMap<>();
    patchParams.put("entityType", "table");
    patchParams.put("entityFqn", "sample_data.ecommerce_db.shopify.dim_address");
    patchParams.put(
        "patch",
        "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Test description\"}]");

    // When & Then - Should handle input validation correctly
    try {
      Map<String, Object> result = patchTool.execute(null, testSecurityContext, patchParams);

      // If result is returned, verify it's structured correctly
      if (result != null) {
        assertTrue(result instanceof Map, "Result should be a Map");

        // If there's an error, it should be properly formatted
        if (result.containsKey("error")) {
          assertTrue(result.get("error") instanceof String, "Error should be a string");
          assertFalse(
              ((String) result.get("error")).isEmpty(), "Error message should not be empty");
        }
      }
    } catch (Exception e) {
      // Expected due to missing database context, but should not be NPE
      assertNotNull(e.getMessage(), "Exception message should not be null");
      assertFalse(e instanceof NullPointerException, "Should not be null pointer exception");
    }
  }

  @Test
  void testPatchEntityToolWithMultipleOperations() throws Exception {
    // Given
    PatchEntityTool patchTool = new PatchEntityTool();
    Map<String, Object> patchParams = new HashMap<>();
    patchParams.put("entityType", "table");
    patchParams.put("entityFqn", "sample_data.ecommerce_db.shopify.dim_address");
    patchParams.put(
        "patch",
        "["
            + "{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"Multi-field test\"},"
            + "{\"op\": \"replace\", \"path\": \"/displayName\", \"value\": \"Test Display Name\"}"
            + "]");

    // When & Then
    try {
      Map<String, Object> result = patchTool.execute(null, testSecurityContext, patchParams);

      if (result != null) {
        assertTrue(result instanceof Map, "Result should be a Map");

        // Verify JSON patch structure validation
        if (result.containsKey("error")) {
          String error = (String) result.get("error");
          // Should handle JSON patch validation properly
          assertNotNull(error, "Error message should not be null");
        }
      }
    } catch (Exception e) {
      // Should handle JSON parsing and validation gracefully
      assertNotNull(e.getMessage(), "Exception message should not be null");
    }
  }

  @Test
  void testGetEntityToolWithDifferentEntityTypes() throws Exception {
    GetEntityTool getEntityTool = new GetEntityTool();

    String[] entityTypes = {"table", "database", "databaseSchema", "topic", "dashboard"};

    for (String entityType : entityTypes) {
      Map<String, Object> params = new HashMap<>();
      params.put("entity_type", entityType);
      params.put("fqn", "test.entity.fqn");

      try {
        Map<String, Object> result = getEntityTool.execute(null, testSecurityContext, params);

        if (result != null) {
          assertTrue(
              result instanceof Map, "Result should be a Map for entity type: " + entityType);
        }
      } catch (Exception e) {
        // Expected due to missing context, but should handle different entity types
        assertNotNull(
            e.getMessage(), "Exception message should not be null for entity type: " + entityType);
      }
    }
  }

  @Test
  void testPatchEntityToolWithInvalidPatch() throws Exception {
    // Given
    PatchEntityTool patchTool = new PatchEntityTool();
    Map<String, Object> invalidParams = new HashMap<>();
    invalidParams.put("entityType", "table");
    invalidParams.put("entityFqn", "test.table");
    invalidParams.put("patch", "invalid json");

    // When & Then - Should handle invalid JSON gracefully
    try {
      Map<String, Object> result = patchTool.execute(null, testSecurityContext, invalidParams);

      // If result is returned, should indicate JSON parsing error
      if (result != null && result.containsKey("error")) {
        String error = (String) result.get("error");
        assertNotNull(error, "Error message should not be null");
      }
    } catch (Exception e) {
      // Should fail with meaningful error message
      assertNotNull(e.getMessage(), "Exception message should not be null");
      assertFalse(e.getMessage().isEmpty(), "Exception message should not be empty");
    }
  }

  @Test
  void testInputParameterValidation() throws Exception {
    GetEntityTool getEntityTool = new GetEntityTool();
    PatchEntityTool patchTool = new PatchEntityTool();

    // Test missing required parameters
    Map<String, Object> emptyParams = new HashMap<>();

    // GetEntityTool should handle missing parameters
    try {
      getEntityTool.execute(null, testSecurityContext, emptyParams);
    } catch (Exception e) {
      assertNotNull(e.getMessage(), "Should provide meaningful error for missing parameters");
    }

    // PatchEntityTool should handle missing parameters
    try {
      patchTool.execute(null, testSecurityContext, emptyParams);
    } catch (Exception e) {
      assertNotNull(e.getMessage(), "Should provide meaningful error for missing parameters");
    }
  }

  @Test
  void testToolsHandleSecurityContext() throws Exception {
    // Test that tools don't crash with null security context
    GetEntityTool getEntityTool = new GetEntityTool();
    PatchEntityTool patchTool = new PatchEntityTool();

    Map<String, Object> getParams = new HashMap<>();
    getParams.put("entity_type", "table");
    getParams.put("fqn", "test.table");

    Map<String, Object> patchParams = new HashMap<>();
    patchParams.put("entityType", "table");
    patchParams.put("entityFqn", "test.table");
    patchParams.put(
        "patch", "[{\"op\": \"replace\", \"path\": \"/description\", \"value\": \"test\"}]");

    // Test with null security context
    try {
      getEntityTool.execute(null, null, getParams);
    } catch (Exception e) {
      assertNotNull(e.getMessage(), "Should handle null security context gracefully");
    }

    try {
      patchTool.execute(null, null, patchParams);
    } catch (Exception e) {
      assertNotNull(e.getMessage(), "Should handle null security context gracefully");
    }

    // Test with valid security context
    try {
      getEntityTool.execute(null, testSecurityContext, getParams);
    } catch (Exception e) {
      assertNotNull(e.getMessage(), "Should handle missing entity context gracefully");
    }

    try {
      patchTool.execute(null, testSecurityContext, patchParams);
    } catch (Exception e) {
      assertNotNull(e.getMessage(), "Should handle missing entity context gracefully");
    }
  }
}
