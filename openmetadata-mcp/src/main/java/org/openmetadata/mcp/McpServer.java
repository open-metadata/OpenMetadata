package org.openmetadata.mcp;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.DispatcherType;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.ServletHolder;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.server.auth.provider.ConnectorOAuthProvider;
import org.openmetadata.mcp.server.auth.settings.ClientRegistrationOptions;
import org.openmetadata.mcp.server.auth.settings.RevocationOptions;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.secrets.SecretsManagerFactory;
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
    addStatelessTransport(contextHandler, authFilter, tools, prompts);
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
      List<McpSchema.Prompt> prompts) {
    try {
      McpSchema.ServerCapabilities serverCapabilities =
          McpSchema.ServerCapabilities.builder()
              .tools(true)
              .prompts(true)
              .resources(true, true)
              .build();
      // Create connector-based OAuth provider (redirect-free, internal OAuth)
      // Get base URL from system settings, fallback to localhost for development
      String baseUrl = getBaseUrlFromSettings();
      // Get default connector from environment (null in production, set for dev/testing)
      String defaultConnector = System.getenv("MCP_DEFAULT_CONNECTOR");
      if (defaultConnector == null || defaultConnector.trim().isEmpty()) {
        defaultConnector = null; // No default in production
        LOG.info("MCP OAuth: No default connector configured (production mode)");
      } else {
        LOG.warn(
            "MCP OAuth: Using default connector '{}' from MCP_DEFAULT_CONNECTOR (dev/test only)",
            defaultConnector);
      }
      ConnectorOAuthProvider authProvider =
          new ConnectorOAuthProvider(
              SecretsManagerFactory.getSecretsManager(),
              (DatabaseServiceRepository) Entity.getEntityRepository(Entity.DATABASE_SERVICE),
              baseUrl,
              defaultConnector);

      // Register default MCP client (for dynamic client registration)
      // Check if client already exists to avoid duplicate entry errors on server restart
      OAuthClientInformation existingClient =
          authProvider.getClient("openmetadata-mcp-client").get();
      if (existingClient == null) {
        OAuthClientInformation mcpClient = new OAuthClientInformation();
        mcpClient.setClientId("openmetadata-mcp-client");
        // Generate random client secret (not used for public PKCE clients, but required by spec)
        mcpClient.setClientSecret(java.util.UUID.randomUUID().toString());
        // TODO: Make redirect URI configurable via MCPConfiguration
        // This default is for development/testing only
        mcpClient.setRedirectUris(
            Collections.singletonList(new URI("http://localhost:3000/callback")));
        mcpClient.setTokenEndpointAuthMethod("none"); // Public client
        mcpClient.setGrantTypes(Arrays.asList("authorization_code", "refresh_token"));
        mcpClient.setResponseTypes(Collections.singletonList("code"));
        authProvider.registerClient(mcpClient).get();
        LOG.info("Registered new MCP OAuth client: openmetadata-mcp-client");
      } else {
        LOG.info("MCP OAuth client already exists: openmetadata-mcp-client");
      }

      // Create registration options
      ClientRegistrationOptions registrationOptions = new ClientRegistrationOptions();
      registrationOptions.setAllowLocalhostRedirect(true);
      // Don't validate scopes for connector-based OAuth - allow any scope
      registrationOptions.setValidScopes(null);

      // Create revocation options
      RevocationOptions revocationOptions = new RevocationOptions();
      revocationOptions.setEnabled(true);

      // Configure allowed origins for CORS
      // TODO: Wire MCPConfiguration into OpenMetadataApplicationConfig and use
      // config.getMcpConfiguration().getAllowedOrigins() instead of hardcoded defaults
      // For production deployments, configure via MCPConfiguration in openmetadata.yaml
      // These defaults are for development only (MCP Inspector ports 6274-6277, UI ports)
      List<String> allowedOrigins =
          Arrays.asList(
              "http://localhost:3000",
              "http://localhost:8585",
              "http://localhost:9090",
              "http://localhost:6274",
              "http://localhost:6275",
              "http://localhost:6276",
              "http://localhost:6277");

      OAuthHttpStatelessServerTransportProvider statelessOauthTransport =
          new OAuthHttpStatelessServerTransportProvider(
              JsonUtils.getObjectMapper(),
              baseUrl,
              "/mcp",
              new AuthEnrichedMcpContextExtractor(),
              authProvider,
              registrationOptions,
              revocationOptions,
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

      contextHandler.addFilter(
          new FilterHolder(authFilter), "/mcp/*", EnumSet.of(DispatcherType.REQUEST));

      // Register OAuth setup endpoint (one-time admin setup)
      // Use /api/v1/mcp/oauth/setup to avoid conflict with /mcp/* wildcard pattern
      org.openmetadata.mcp.server.auth.handlers.OAuthSetupHandler setupHandler =
          new org.openmetadata.mcp.server.auth.handlers.OAuthSetupHandler(
              SecretsManagerFactory.getSecretsManager(),
              (DatabaseServiceRepository) Entity.getEntityRepository(Entity.DATABASE_SERVICE));
      ServletHolder setupHolder = new ServletHolder(setupHandler);
      contextHandler.addServlet(setupHolder, "/api/v1/mcp/oauth/setup");
      LOG.info("Registered OAuth setup endpoint at /api/v1/mcp/oauth/setup");

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
          CatalogSecurityContext securityContext =
              jwtFilter.getCatalogSecurityContext((String) context.get("Authorization"));
          return toolContext.callTool(authorizer, limits, tool.name(), securityContext, req);
        });
  }

  private McpStatelessServerFeatures.SyncPromptSpecification getPrompt(McpSchema.Prompt prompt) {
    return new McpStatelessServerFeatures.SyncPromptSpecification(
        prompt,
        (exchange, arguments) -> promptsContext.callPrompt(jwtFilter, prompt.name(), arguments));
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
            return urlConfig.getOpenMetadataUrl();
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not get instance URL from SystemSettings", e);
    }
    return "http://localhost:8585";
  }
}
