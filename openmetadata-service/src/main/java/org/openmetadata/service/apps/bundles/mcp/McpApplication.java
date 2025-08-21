package org.openmetadata.service.apps.bundles.mcp;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class McpApplication extends AbstractNativeApplication {

  private static McpAppConfiguration currentConfig;

  public McpApplication(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    // Parse and store the app configuration
    String configJson = JsonUtils.pojoToJson(app.getAppConfiguration());
    currentConfig = JsonUtils.readValue(configJson, McpAppConfiguration.class);

    LOG.info(
        "MCP Application initialized with config: maxConnections={}, maxUserConnections={}, circuitBreaker={}",
        currentConfig.getConnectionLimits().getMaxConnections(),
        currentConfig.getConnectionLimits().getMaxUserConnections(),
        currentConfig.getConnectionLimits().isEnableCircuitBreaker());
  }

  /**
   * Get the current MCP configuration for use by McpServer.
   */
  public static McpAppConfiguration getCurrentConfiguration() {
    return currentConfig != null ? currentConfig : new McpAppConfiguration();
  }

  /**
   * MCP Application Configuration
   */
  @Getter
  @Setter
  public static class McpAppConfiguration {
    @JsonProperty("originValidationEnabled")
    private boolean originValidationEnabled = false;

    @JsonProperty("originHeaderUri")
    private String originHeaderUri = "http://localhost";

    @JsonProperty("connectionLimits")
    private ConnectionLimits connectionLimits = new ConnectionLimits();

    @JsonProperty("threadPoolConfig")
    private ThreadPoolConfig threadPoolConfig = new ThreadPoolConfig();
  }

  @Getter
  @Setter
  public static class ConnectionLimits {
    @JsonProperty("maxConnections")
    private int maxConnections = 100;

    @JsonProperty("maxUserConnections")
    private int maxUserConnections = 10;

    @JsonProperty("maxOrgConnections")
    private int maxOrgConnections = 30;

    @JsonProperty("connectionsPerSecond")
    private double connectionsPerSecond = 10.0;

    @JsonProperty("enableCircuitBreaker")
    private boolean enableCircuitBreaker = true;
  }

  @Getter
  @Setter
  public static class ThreadPoolConfig {
    @JsonProperty("sseThreadPoolSize")
    private int sseThreadPoolSize = 10;

    @JsonProperty("streamableThreadPoolSize")
    private int streamableThreadPoolSize = 10;

    @JsonProperty("useVirtualThreads")
    private boolean useVirtualThreads = true;
  }
}
