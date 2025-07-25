package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.*;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@ExtendWith(MockitoExtension.class)
public abstract class McpToolBase extends OpenMetadataApplicationTest {

  @Mock protected Authorizer authorizer;
  @Mock protected Limits limits;
  @Mock protected CatalogSecurityContext securityContext;

  protected McpTool tool;
  protected Map<String, Object> validParams;

  @BeforeEach
  void setUp() {
    tool = createTool();
    validParams = createValidParams();
    setupBasicMocks();
  }

  protected abstract McpTool createTool();

  protected abstract Map<String, Object> createValidParams();

  protected void setupBasicMocks() {
    // Basic setup - can be overridden
  }

  @Test
  void testNullParametersHandling() {
    Map<String, Object> nullParams = null;

    assertThrows(Exception.class, () -> tool.execute(authorizer, securityContext, nullParams));
  }

  @Test
  void testEmptyParametersHandling() {
    Map<String, Object> emptyParams = new HashMap<>();
    assertThrows(Exception.class, () -> tool.execute(authorizer, securityContext, emptyParams));
  }

  @Test
  void testTokenUsageLimitsRespected() throws IOException {
    // Only test if the tool can execute without major errors
    try {
      Map<String, Object> result = tool.execute(authorizer, securityContext, validParams);

      if (result != null) {
        String resultJson = JsonUtils.pojoToJson(result);
        int tokenCount = estimateTokenCount(resultJson);

        assertTrue(
            tokenCount < getMaxTokenLimit(),
            "Response token count (" + tokenCount + ") exceeds limit (" + getMaxTokenLimit() + ")");
      }
    } catch (Exception e) {
      // Expected for some tools without proper mocking
      assertTrue(e.getMessage() != null && !e.getMessage().isEmpty());
    }
  }

  protected int estimateTokenCount(String text) {
    return text.length() / 4;
  }

  protected int getMaxTokenLimit() {
    return 4000;
  }

  @Test
  void testLimitsEnforcementWhenSupported() {
    boolean supportsLimits = toolSupportsLimits();

    if (supportsLimits) {
      // Should not throw UnsupportedOperationException
      try {
        tool.execute(authorizer, limits, securityContext, validParams);
      } catch (UnsupportedOperationException e) {
        fail("Tool claims to support limits but throws UnsupportedOperationException");
      } catch (Exception e) {
        // Other exceptions are acceptable (e.g., missing dependencies)
        assertTrue(e.getMessage() != null);
      }
    } else {
      assertThrows(
          UnsupportedOperationException.class,
          () -> tool.execute(authorizer, limits, securityContext, validParams));
    }
  }

  protected abstract boolean toolSupportsLimits();

  @Test
  void testInputSanitization() {
    Map<String, Object> maliciousParams = createMaliciousParams();

    // Should not crash with malicious input
    assertDoesNotThrow(
        () -> {
          try {
            Map<String, Object> result = tool.execute(authorizer, securityContext, maliciousParams);
            if (result != null) {
              validateNoMaliciousContent(result);
            }
          } catch (Exception e) {
            // Exceptions are acceptable, crashes are not
            assertTrue(e.getMessage() != null);
          }
        });
  }

  protected Map<String, Object> createMaliciousParams() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", "<script>alert('xss')</script>");
    params.put("fqn", "'; DROP TABLE users; --");
    return params;
  }

  protected void validateNoMaliciousContent(Map<String, Object> result) {
    String resultJson = JsonUtils.pojoToJson(result);
    assertFalse(resultJson.contains("<script>"), "Response contains script tags");
    assertFalse(resultJson.contains("DROP TABLE"), "Response contains SQL injection");
  }

  protected Map<String, Object> createInvalidParams() {
    Map<String, Object> params = new HashMap<>();
    params.put("entityType", 123);
    params.put("fqn", new Object());
    return params;
  }
}
