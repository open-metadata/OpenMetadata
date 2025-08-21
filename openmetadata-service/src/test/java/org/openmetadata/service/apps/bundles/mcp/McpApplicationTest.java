package org.openmetadata.service.apps.bundles.mcp;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@DisplayName("MCP Application Tests")
class McpApplicationTest {

  private McpApplication mcpApplication;
  private CollectionDAO mockCollectionDAO;
  private SearchRepository mockSearchRepository;
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    mockCollectionDAO = mock(CollectionDAO.class);
    mockSearchRepository = mock(SearchRepository.class);
    mcpApplication = new McpApplication(mockCollectionDAO, mockSearchRepository);
    objectMapper = JsonUtils.getObjectMapper();
  }

  @Test
  @DisplayName("Should initialize with default configuration")
  void testDefaultConfiguration() {
    // Given
    App app = new App();
    Map<String, Object> defaultConfig = new HashMap<>();
    defaultConfig.put("originValidationEnabled", false);
    defaultConfig.put("originHeaderUri", "http://localhost");
    app.setAppConfiguration(defaultConfig);

    // When
    mcpApplication.init(app);
    McpApplication.McpAppConfiguration config = McpApplication.getCurrentConfiguration();

    // Then
    assertNotNull(config);
    assertFalse(config.isOriginValidationEnabled());
    assertEquals("http://localhost", config.getOriginHeaderUri());

    // Connection limits should have defaults
    assertNotNull(config.getConnectionLimits());
    assertEquals(100, config.getConnectionLimits().getMaxConnections());
    assertEquals(10, config.getConnectionLimits().getMaxUserConnections());
    assertEquals(30, config.getConnectionLimits().getMaxOrgConnections());
    assertEquals(10.0, config.getConnectionLimits().getConnectionsPerSecond());
    assertTrue(config.getConnectionLimits().isEnableCircuitBreaker());

    // Thread pool config should have defaults
    assertNotNull(config.getThreadPoolConfig());
    assertEquals(10, config.getThreadPoolConfig().getSseThreadPoolSize());
    assertEquals(10, config.getThreadPoolConfig().getStreamableThreadPoolSize());
    assertTrue(config.getThreadPoolConfig().isUseVirtualThreads());
  }

  @Test
  @DisplayName("Should initialize with custom configuration")
  void testCustomConfiguration() {
    // Given
    App app = new App();
    Map<String, Object> customConfig = new HashMap<>();
    customConfig.put("originValidationEnabled", true);
    customConfig.put("originHeaderUri", "https://example.com");

    Map<String, Object> connectionLimits = new HashMap<>();
    connectionLimits.put("maxConnections", 250);
    connectionLimits.put("maxUserConnections", 20);
    connectionLimits.put("maxOrgConnections", 75);
    connectionLimits.put("connectionsPerSecond", 25.0);
    connectionLimits.put("enableCircuitBreaker", false);
    customConfig.put("connectionLimits", connectionLimits);

    Map<String, Object> threadPoolConfig = new HashMap<>();
    threadPoolConfig.put("sseThreadPoolSize", 20);
    threadPoolConfig.put("streamableThreadPoolSize", 25);
    threadPoolConfig.put("useVirtualThreads", false);
    customConfig.put("threadPoolConfig", threadPoolConfig);

    app.setAppConfiguration(customConfig);

    // When
    mcpApplication.init(app);
    McpApplication.McpAppConfiguration config = McpApplication.getCurrentConfiguration();

    // Then
    assertNotNull(config);
    assertTrue(config.isOriginValidationEnabled());
    assertEquals("https://example.com", config.getOriginHeaderUri());

    // Verify connection limits
    assertEquals(250, config.getConnectionLimits().getMaxConnections());
    assertEquals(20, config.getConnectionLimits().getMaxUserConnections());
    assertEquals(75, config.getConnectionLimits().getMaxOrgConnections());
    assertEquals(25.0, config.getConnectionLimits().getConnectionsPerSecond());
    assertFalse(config.getConnectionLimits().isEnableCircuitBreaker());

    // Verify thread pool config
    assertEquals(20, config.getThreadPoolConfig().getSseThreadPoolSize());
    assertEquals(25, config.getThreadPoolConfig().getStreamableThreadPoolSize());
    assertFalse(config.getThreadPoolConfig().isUseVirtualThreads());
  }

  @Test
  @DisplayName("Should handle partial configuration")
  void testPartialConfiguration() {
    // Given - only connection limits specified
    App app = new App();
    Map<String, Object> partialConfig = new HashMap<>();

    Map<String, Object> connectionLimits = new HashMap<>();
    connectionLimits.put("maxConnections", 150);
    connectionLimits.put("maxUserConnections", 15);
    // Other fields should use defaults
    partialConfig.put("connectionLimits", connectionLimits);

    app.setAppConfiguration(partialConfig);

    // When
    mcpApplication.init(app);
    McpApplication.McpAppConfiguration config = McpApplication.getCurrentConfiguration();

    // Then
    assertNotNull(config);

    // Specified values
    assertEquals(150, config.getConnectionLimits().getMaxConnections());
    assertEquals(15, config.getConnectionLimits().getMaxUserConnections());

    // Default values for unspecified fields
    assertEquals(30, config.getConnectionLimits().getMaxOrgConnections());
    assertEquals(10.0, config.getConnectionLimits().getConnectionsPerSecond());
    assertTrue(config.getConnectionLimits().isEnableCircuitBreaker());

    // Thread pool config should be all defaults
    assertEquals(10, config.getThreadPoolConfig().getSseThreadPoolSize());
    assertEquals(10, config.getThreadPoolConfig().getStreamableThreadPoolSize());
    assertTrue(config.getThreadPoolConfig().isUseVirtualThreads());
  }

  @Test
  @DisplayName("Should return default configuration when not initialized")
  void testGetConfigurationBeforeInit() {
    // When - get configuration before init
    McpApplication.McpAppConfiguration config = McpApplication.getCurrentConfiguration();

    // Then - should return default configuration
    assertNotNull(config);
    assertEquals(100, config.getConnectionLimits().getMaxConnections());
    assertEquals(10, config.getConnectionLimits().getMaxUserConnections());
    assertEquals(30, config.getConnectionLimits().getMaxOrgConnections());
  }

  @Test
  @DisplayName("Should serialize and deserialize configuration correctly")
  void testConfigurationSerialization() throws Exception {
    // Given
    McpApplication.McpAppConfiguration originalConfig = new McpApplication.McpAppConfiguration();
    originalConfig.setOriginValidationEnabled(true);
    originalConfig.setOriginHeaderUri("https://test.com");

    originalConfig.getConnectionLimits().setMaxConnections(200);
    originalConfig.getConnectionLimits().setMaxUserConnections(25);
    originalConfig.getConnectionLimits().setMaxOrgConnections(50);
    originalConfig.getConnectionLimits().setConnectionsPerSecond(15.0);
    originalConfig.getConnectionLimits().setEnableCircuitBreaker(false);

    originalConfig.getThreadPoolConfig().setSseThreadPoolSize(15);
    originalConfig.getThreadPoolConfig().setStreamableThreadPoolSize(20);
    originalConfig.getThreadPoolConfig().setUseVirtualThreads(false);

    // When - serialize and deserialize
    String json = objectMapper.writeValueAsString(originalConfig);
    McpApplication.McpAppConfiguration deserializedConfig =
        objectMapper.readValue(json, McpApplication.McpAppConfiguration.class);

    // Then
    assertEquals(
        originalConfig.isOriginValidationEnabled(), deserializedConfig.isOriginValidationEnabled());
    assertEquals(originalConfig.getOriginHeaderUri(), deserializedConfig.getOriginHeaderUri());

    assertEquals(
        originalConfig.getConnectionLimits().getMaxConnections(),
        deserializedConfig.getConnectionLimits().getMaxConnections());
    assertEquals(
        originalConfig.getConnectionLimits().getMaxUserConnections(),
        deserializedConfig.getConnectionLimits().getMaxUserConnections());
    assertEquals(
        originalConfig.getConnectionLimits().getMaxOrgConnections(),
        deserializedConfig.getConnectionLimits().getMaxOrgConnections());
    assertEquals(
        originalConfig.getConnectionLimits().getConnectionsPerSecond(),
        deserializedConfig.getConnectionLimits().getConnectionsPerSecond());
    assertEquals(
        originalConfig.getConnectionLimits().isEnableCircuitBreaker(),
        deserializedConfig.getConnectionLimits().isEnableCircuitBreaker());

    assertEquals(
        originalConfig.getThreadPoolConfig().getSseThreadPoolSize(),
        deserializedConfig.getThreadPoolConfig().getSseThreadPoolSize());
    assertEquals(
        originalConfig.getThreadPoolConfig().getStreamableThreadPoolSize(),
        deserializedConfig.getThreadPoolConfig().getStreamableThreadPoolSize());
    assertEquals(
        originalConfig.getThreadPoolConfig().isUseVirtualThreads(),
        deserializedConfig.getThreadPoolConfig().isUseVirtualThreads());
  }

  @Test
  @DisplayName("Should handle invalid configuration gracefully")
  void testInvalidConfiguration() {
    // Given
    App app = new App();
    Map<String, Object> invalidConfig = new HashMap<>();

    Map<String, Object> connectionLimits = new HashMap<>();
    connectionLimits.put("maxConnections", -1); // Invalid negative value
    connectionLimits.put("maxUserConnections", 0); // Invalid zero value
    invalidConfig.put("connectionLimits", connectionLimits);

    app.setAppConfiguration(invalidConfig);

    // When
    mcpApplication.init(app);
    McpApplication.McpAppConfiguration config = McpApplication.getCurrentConfiguration();

    // Then - should handle gracefully with defaults
    assertNotNull(config);
    // The actual values depend on how the application handles invalid config
    // This test verifies it doesn't throw exceptions
  }

  @Test
  @DisplayName("Should create proper JSON structure for UI")
  void testConfigurationJsonStructure() throws Exception {
    // Given
    McpApplication.McpAppConfiguration config = new McpApplication.McpAppConfiguration();

    // When
    String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(config);

    // Then
    assertTrue(json.contains("\"originValidationEnabled\""));
    assertTrue(json.contains("\"originHeaderUri\""));
    assertTrue(json.contains("\"connectionLimits\""));
    assertTrue(json.contains("\"maxConnections\""));
    assertTrue(json.contains("\"maxUserConnections\""));
    assertTrue(json.contains("\"maxOrgConnections\""));
    assertTrue(json.contains("\"connectionsPerSecond\""));
    assertTrue(json.contains("\"enableCircuitBreaker\""));
    assertTrue(json.contains("\"threadPoolConfig\""));
    assertTrue(json.contains("\"sseThreadPoolSize\""));
    assertTrue(json.contains("\"streamableThreadPoolSize\""));
    assertTrue(json.contains("\"useVirtualThreads\""));
  }
}
