package org.openmetadata.sdk;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;

/**
 * Base test class for SDK tests providing common setup and utilities.
 */
public abstract class BaseSDKTest {
  protected static final String TEST_SERVER_URL = "http://localhost:8585/api";
  protected static final String TEST_USER_EMAIL = "test@openmetadata.org";

  protected OpenMetadataClient client;
  protected OpenMetadataConfig config;
  protected ObjectMapper objectMapper;
  private AutoCloseable mocks;

  @BeforeEach
  void setUp() throws Exception {
    mocks = MockitoAnnotations.openMocks(this);
    objectMapper = new ObjectMapper();

    // Setup test configuration
    config =
        OpenMetadataConfig.builder()
            .baseUrl(TEST_SERVER_URL)
            .testMode(true)
            .accessToken(TEST_USER_EMAIL)
            .connectTimeout(5000)
            .readTimeout(5000)
            .build();

    // Initialize client
    client = new OpenMetadataClient(config);

    // Initialize OM with test client
    OM.init(client);

    // Allow subclasses to do additional setup
    additionalSetUp();
  }

  @AfterEach
  void tearDown() throws Exception {
    additionalTearDown();
    if (mocks != null) {
      mocks.close();
    }
  }

  /**
   * Override in subclasses for additional setup
   */
  protected void additionalSetUp() throws Exception {
    // Default empty implementation
  }

  /**
   * Override in subclasses for additional teardown
   */
  protected void additionalTearDown() throws Exception {
    // Default empty implementation
  }

  /**
   * Generate a unique name for test entities
   */
  protected String generateTestName(String prefix) {
    return prefix + "_" + UUID.randomUUID().toString().substring(0, 8);
  }

  /**
   * Clean up an entity after test
   */
  protected void cleanupEntity(EntityInterface entity) {
    if (entity != null && entity.getId() != null) {
      try {
        // TODO: Implement generic delete once available in client
        // For now, use entity-specific delete methods in subclasses
      } catch (Exception e) {
        // Log but don't fail test on cleanup errors
        System.err.println("Failed to cleanup entity: " + e.getMessage());
      }
    }
  }

  private String getEntityEndpoint(EntityInterface entity) {
    String entityType = entity.getEntityReference().getType();
    return "/v1/" + entityType.toLowerCase() + "s";
  }

  /**
   * Assert that two entities are equivalent (ignoring server-generated fields)
   */
  protected void assertEntitiesEqual(EntityInterface expected, EntityInterface actual) {
    // Compare key fields, ignoring server-generated ones like version, updatedAt, etc.
    assertEquals(expected.getName(), actual.getName());
    assertEquals(expected.getDescription(), actual.getDescription());
    assertEquals(expected.getDisplayName(), actual.getDisplayName());
    // Add more field comparisons as needed
  }

  private void assertEquals(Object expected, Object actual) {
    if (expected == null && actual == null) {
      return;
    }
    if (expected == null || actual == null) {
      throw new AssertionError("Expected: " + expected + ", Actual: " + actual);
    }
    if (!expected.equals(actual)) {
      throw new AssertionError("Expected: " + expected + ", Actual: " + actual);
    }
  }
}
