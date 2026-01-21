package org.openmetadata.mcp;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.DispatcherType;
import java.util.Arrays;
import java.util.Collections;
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
      // Get base URL from system settings, fallback to localhost for development
      String baseUrl = getBaseUrlFromSettings();
      if (baseUrl == null || baseUrl.trim().isEmpty()) {
        baseUrl = "http://localhost:8585";
        LOG.warn("Base URL not configured, using default: {}", baseUrl);
      }

      org.openmetadata.service.security.AuthenticationCodeFlowHandler ssoHandler = null;
      try {
        ssoHandler = org.openmetadata.service.security.AuthenticationCodeFlowHandler.getInstance();
        LOG.info("SSO AuthenticationCodeFlowHandler initialized for MCP OAuth");
      } catch (IllegalStateException e) {
        LOG.warn(
            "SSO AuthenticationCodeFlowHandler not initialized, SSO OAuth flow will not be available. Basic Auth will still work.",
            e);
      }

      org.openmetadata.service.security.jwt.JWTTokenGenerator jwtGenerator =
          org.openmetadata.service.security.jwt.JWTTokenGenerator.getInstance();
      org.openmetadata.service.security.auth.BasicAuthenticator basicAuthenticator =
          new org.openmetadata.service.security.auth.BasicAuthenticator();

      basicAuthenticator.init(config);
      LOG.info("BasicAuthenticator initialized for MCP OAuth with userRepository");

      org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider authProvider =
          new org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider(
              ssoHandler, jwtGenerator, basicAuthenticator, baseUrl);

      // Configure allowed origins for CORS
      // Check if we're in development mode (baseUrl contains localhost or is empty)
      // In production, these should be configured via MCPConfiguration
      List<String> allowedOrigins;
      boolean isDevelopmentMode =
          baseUrl == null
              || baseUrl.isEmpty()
              || baseUrl.contains("localhost")
              || baseUrl.contains("127.0.0.1");

      if (isDevelopmentMode) {
        // Development mode: Allow common localhost ports with warning
        LOG.warn(
            "MCP OAuth CORS: Using default localhost origins (development mode detected). "
                + "For production, configure allowedOrigins via MCPConfiguration in openmetadata.yaml");
        allowedOrigins =
            Arrays.asList(
                "http://localhost:3000",
                "http://localhost:8585",
                "http://localhost:9090",
                "http://localhost:6274", // MCP Inspector
                "http://localhost:6275",
                "http://localhost:6276",
                "http://localhost:6277");
      } else {
        // Production mode: Use minimal CORS (same origin only)
        // TODO: Wire MCPConfiguration.getAllowedOrigins() when available
        LOG.warn(
            "MCP OAuth CORS: Production mode detected. Using same-origin policy only. "
                + "Configure allowedOrigins via MCPConfiguration for cross-origin access.");
        allowedOrigins = Collections.emptyList(); // No cross-origin requests allowed
      }

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
          try {
            // Extract and populate AuthContext for scope validation in async thread
            String authHeader = (String) context.get("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
              populateAuthContextFromJWT(authHeader.substring(7));
            }

            CatalogSecurityContext securityContext =
                jwtFilter.getCatalogSecurityContext(authHeader);
            return toolContext.callTool(authorizer, limits, tool.name(), securityContext, req);
          } finally {
            // Always clear AuthContext after tool execution
            org.openmetadata.mcp.server.auth.middleware.AuthContext.clearCurrent();
          }
        });
  }

  /**
   * Populates AuthContext with scopes from JWT for async tool execution.
   * This is needed because tool execution happens in a different thread (reactive/async)
   * and ThreadLocal doesn't propagate automatically.
   */
  private void populateAuthContextFromJWT(String jwtToken) {
    try {
      // Parse JWT to extract claims
      String[] parts = jwtToken.split("\\.");
      if (parts.length < 2) {
        LOG.warn("Invalid JWT format - cannot extract scopes for AuthContext");
        return;
      }

      // Decode the payload (second part)
      String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
      com.fasterxml.jackson.databind.JsonNode claims =
          new com.fasterxml.jackson.databind.ObjectMapper().readTree(payload);

      // Extract username and scopes from JWT claims
      String username = claims.has("sub") ? claims.get("sub").asText() : null;

      // OAuth scopes are typically stored in a "scope" claim as space-separated string
      final java.util.List<String> scopes = new java.util.ArrayList<>();
      if (claims.has("scope")) {
        String scopeString = claims.get("scope").asText();
        if (scopeString != null && !scopeString.isEmpty()) {
          scopes.addAll(java.util.Arrays.asList(scopeString.split(" ")));
        }
      } else if (claims.has("scopes")) {
        // Some JWT implementations use "scopes" array
        com.fasterxml.jackson.databind.JsonNode scopesNode = claims.get("scopes");
        if (scopesNode.isArray()) {
          scopesNode.forEach(scope -> scopes.add(scope.asText()));
        }
      }

      // If no explicit scopes in JWT, grant default scopes for backward compatibility
      if (scopes.isEmpty()) {
        LOG.debug("No scopes found in JWT, granting default scopes for user: {}", username);
        scopes.addAll(java.util.Arrays.asList("openid", "profile", "email"));
      }

      // Create AccessToken and populate AuthContext
      org.openmetadata.mcp.auth.AccessToken accessToken =
          new org.openmetadata.mcp.auth.AccessToken();
      accessToken.setToken(jwtToken);
      accessToken.setScopes(scopes);
      accessToken.setClientId(username); // Store username as clientId for context

      org.openmetadata.mcp.server.auth.middleware.AuthContext authContext =
          new org.openmetadata.mcp.server.auth.middleware.AuthContext(accessToken);
      org.openmetadata.mcp.server.auth.middleware.AuthContext.setCurrent(authContext);

      LOG.debug(
          "Populated AuthContext in async thread for user: {} with scopes: {}", username, scopes);

    } catch (Exception e) {
      LOG.error("Failed to populate AuthContext from JWT in async thread", e);
      // Don't fail the request - let ScopeInterceptor handle missing AuthContext if needed
    }
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
