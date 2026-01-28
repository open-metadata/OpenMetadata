package org.openmetadata.mcp;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.DispatcherType;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.ee10.servlet.FilterHolder;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.server.auth.jobs.OAuthTokenCleanupScheduler;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

@Slf4j
public class McpServer implements McpServerProvider {
  private JwtFilter jwtFilter;
  private Authorizer authorizer;
  private Limits limits;
  protected DefaultToolContext toolContext;
  protected DefaultPromptsContext promptsContext;
  private Environment environment;

  // Default constructor for dynamic loading
  public McpServer() {
    this.toolContext = new DefaultToolContext();
    this.promptsContext = new DefaultPromptsContext();
  }

  public McpServer(DefaultToolContext toolContext, DefaultPromptsContext promptsContext) {
    this.toolContext = toolContext;
    this.promptsContext = promptsContext;
  }

  @Override
  public void initializeMcpServer(
      Environment environment,
      Authorizer authorizer,
      Limits limits,
      OpenMetadataApplicationConfig config) {
    this.jwtFilter =
        new JwtFilter(
            SecurityConfigurationManager.getCurrentAuthConfig(),
            SecurityConfigurationManager.getCurrentAuthzConfig());
    this.authorizer = authorizer;
    this.limits = limits;
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    McpAuthFilter authFilter =
        new McpAuthFilter(
            new JwtFilter(
                SecurityConfigurationManager.getCurrentAuthConfig(),
                SecurityConfigurationManager.getCurrentAuthzConfig()));
    List<McpSchema.Tool> tools = getTools();
    List<McpSchema.Prompt> prompts = getPrompts();
    addStatelessTransport(contextHandler, authFilter, tools, prompts, config);
  }

  protected List<McpSchema.Tool> getTools() {
    return toolContext.loadToolsDefinitionsFromJson("json/data/mcp/tools.json");
  }

  protected List<McpSchema.Prompt> getPrompts() {
    return promptsContext.loadPromptsDefinitionsFromJson("json/data/mcp/prompts.json");
  }

  private void addStatelessTransport(
      MutableServletContextHandler contextHandler,
      McpAuthFilter authFilter,
      List<McpSchema.Tool> tools,
      List<McpSchema.Prompt> prompts,
      OpenMetadataApplicationConfig config) {
    try {
      McpSchema.ServerCapabilities serverCapabilities =
          McpSchema.ServerCapabilities.builder()
              .tools(true)
              .prompts(true)
              .resources(true, true)
              .build();
      // Create unified OAuth provider for MCP authentication (supports both SSO and Basic Auth)
      // Get base URL from MCP configuration or system settings
      String baseUrl = getBaseUrlFromConfig();
      LOG.info("MCP OAuth initialized with base URL: {}", baseUrl);

      org.openmetadata.service.security.jwt.JWTTokenGenerator jwtGenerator =
          org.openmetadata.service.security.jwt.JWTTokenGenerator.getInstance();
      org.openmetadata.service.security.auth.BasicAuthenticator basicAuthenticator =
          new org.openmetadata.service.security.auth.BasicAuthenticator();

      basicAuthenticator.init(config);
      LOG.info("BasicAuthenticator initialized for MCP OAuth with userRepository");

      org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider authProvider =
          new org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider(
              jwtGenerator, basicAuthenticator);

      // Get allowed origins from MCP configuration (database-backed)
      List<String> allowedOrigins = getAllowedOriginsFromConfig();
      LOG.info("MCP OAuth CORS: Using allowed origins from configuration: {}", allowedOrigins);

      // Initialize OAuth token cleanup scheduler (runs hourly to delete expired tokens)
      OAuthTokenCleanupScheduler.initialize();

      OAuthHttpStatelessServerTransportProvider statelessOauthTransport =
          new OAuthHttpStatelessServerTransportProvider(
              JsonUtils.getObjectMapper(),
              baseUrl,
              "/mcp",
              new AuthEnrichedMcpContextExtractor(),
              authProvider,
              allowedOrigins);
      McpStatelessSyncServer server =
          io.modelcontextprotocol.server.McpServer.sync(statelessOauthTransport)
              .serverInfo("openmetadata-mcp-stateless", "0.11.2")
              .capabilities(serverCapabilities)
              .build();
      addToolsToServer(server, tools);
      addPromptsToServer(server, prompts);

      // SSE transport for MCP
      ServletHolder servletHolderSSE = new ServletHolder(statelessOauthTransport);
      contextHandler.addServlet(servletHolderSSE, "/mcp/*");

      // Note: McpAuthFilter is NOT applied to /mcp/* because
      // OAuthHttpStatelessServerTransportProvider
      // handles its own OAuth authentication internally. Applying an external auth filter would
      // block
      // the OAuth handshake that happens at the transport layer.

      // Register SSO callback endpoint for user authentication
      org.openmetadata.schema.auth.SSOAuthMechanism.SsoServiceType ssoServiceType =
          org.openmetadata.schema.auth.SSOAuthMechanism.SsoServiceType.GOOGLE; // Default to Google
      try {
        org.openmetadata.schema.api.security.AuthenticationConfiguration authConfig =
            SecurityConfigurationManager.getCurrentAuthConfig();
        if (authConfig != null && authConfig.getProvider() != null) {
          String providerStr = authConfig.getProvider().toString().toUpperCase();
          ssoServiceType =
              org.openmetadata.schema.auth.SSOAuthMechanism.SsoServiceType.valueOf(providerStr);
        }
      } catch (Exception e) {
        LOG.warn("Could not determine SSO provider type, using default GOOGLE", e);
      }

      org.openmetadata.service.security.AuthenticationCodeFlowHandler ssoHandler =
          org.openmetadata.service.security.AuthenticationCodeFlowHandler.getInstance();
      org.openmetadata.mcp.server.auth.handlers.SSOCallbackServlet ssoCallbackServlet =
          new org.openmetadata.mcp.server.auth.handlers.SSOCallbackServlet(
              authProvider, ssoHandler, ssoServiceType);
      ServletHolder ssoCallbackHolder = new ServletHolder(ssoCallbackServlet);
      contextHandler.addServlet(ssoCallbackHolder, "/mcp/callback");
      LOG.info("Registered SSO callback endpoint at /mcp/callback");

      // Add well-known filter at root level for OAuth discovery (RFC 8414)
      OAuthWellKnownFilter wellKnownFilter = new OAuthWellKnownFilter();
      contextHandler.addFilter(
          new FilterHolder(wellKnownFilter),
          "/*",
          EnumSet.of(DispatcherType.REQUEST, DispatcherType.FORWARD));

      LOG.info("OAuth well-known endpoints configured at root level for RFC 8414 discovery");
    } catch (Exception ex) {
      LOG.error("Error adding stateless transport", ex);
    }
  }

  public void addToolsToServer(McpStatelessSyncServer server, List<McpSchema.Tool> tools) {
    for (McpSchema.Tool tool : tools) {
      server.addTool(getTool(tool));
    }
  }

  public void addPromptsToServer(McpStatelessSyncServer server, List<McpSchema.Prompt> tools) {
    for (McpSchema.Prompt pm : tools) {
      server.addPrompt(getPrompt(pm));
    }
  }

  private McpStatelessServerFeatures.SyncToolSpecification getTool(McpSchema.Tool tool) {
    return new McpStatelessServerFeatures.SyncToolSpecification(
        tool,
        (context, req) -> {
          String authHeader = (String) context.get("Authorization");
          CatalogSecurityContext securityContext = jwtFilter.getCatalogSecurityContext(authHeader);
          return toolContext.callTool(authorizer, limits, tool.name(), securityContext, req);
        });
  }

  private McpStatelessServerFeatures.SyncPromptSpecification getPrompt(McpSchema.Prompt prompt) {
    return new McpStatelessServerFeatures.SyncPromptSpecification(
        prompt,
        (exchange, arguments) -> promptsContext.callPrompt(jwtFilter, prompt.name(), arguments));
  }

  private String getBaseUrlFromConfig() {
    try {
      org.openmetadata.schema.api.configuration.MCPConfiguration mcpConfig =
          SecurityConfigurationManager.getCurrentMcpConfig();
      if (mcpConfig != null && mcpConfig.getBaseUrl() != null) {
        LOG.info("Base URL retrieved from MCP configuration: {}", mcpConfig.getBaseUrl());
        return mcpConfig.getBaseUrl();
      }
    } catch (Exception e) {
      LOG.warn("Failed to get base URL from MCP config: {}", e.getMessage());
    }
    return getBaseUrlFromSettings();
  }

  private List<String> getAllowedOriginsFromConfig() {
    try {
      org.openmetadata.schema.api.configuration.MCPConfiguration mcpConfig =
          SecurityConfigurationManager.getCurrentMcpConfig();
      if (mcpConfig != null && mcpConfig.getAllowedOrigins() != null) {
        return mcpConfig.getAllowedOrigins();
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to get allowed origins from MCP config, using development defaults: {}",
          e.getMessage());
    }
    LOG.warn(
        "MCP configuration not available, using development localhost origins. "
            + "This should NOT happen in production. Please configure MCP settings via the API.");
    return Arrays.asList("http://localhost:3000", "http://localhost:8585", "http://localhost:9090");
  }

  /**
   * Get base URL from system settings, with fallback to localhost for development.
   */
  private String getBaseUrlFromSettings() {
    try {
      org.openmetadata.service.jdbi3.SystemRepository systemRepository =
          Entity.getSystemRepository();
      if (systemRepository != null) {
        org.openmetadata.schema.settings.Settings settings =
            systemRepository.getOMBaseUrlConfigInternal();
        if (settings != null && settings.getConfigValue() != null) {
          org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration urlConfig =
              (org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration)
                  settings.getConfigValue();
          if (urlConfig != null && urlConfig.getOpenMetadataUrl() != null) {
            String url = urlConfig.getOpenMetadataUrl();
            LOG.info("Base URL retrieved from system settings: {}", url);
            return url;
          }
        }
      } else {
        LOG.warn("SystemRepository is null during MCP initialization");
      }
    } catch (Exception e) {
      LOG.warn("Could not get instance URL from SystemSettings, using fallback", e);
    }
    LOG.info("Using fallback base URL: http://localhost:8585");
    return "http://localhost:8585";
  }
}
