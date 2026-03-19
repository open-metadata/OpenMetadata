package org.openmetadata.mcp;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.server.auth.jobs.OAuthTokenCleanupScheduler;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

@Slf4j
public class McpServer implements McpServerProvider {
  private static final String MCP_APP_NAME = "McpApplication";
  private static final String DEFAULT_MCP_BOT_NAME = MCP_APP_NAME + "Bot";

  protected JwtFilter jwtFilter;
  protected Authorizer authorizer;
  protected Limits limits;
  protected DefaultToolContext toolContext;
  protected DefaultPromptsContext promptsContext;
  private Environment environment;
  private volatile String mcpBotName;

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
    this.environment = environment;
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    List<McpSchema.Tool> tools = getTools();
    List<McpSchema.Prompt> prompts = getPrompts();
    addStatelessTransport(contextHandler, tools, prompts, config);
  }

  protected List<McpSchema.Tool> getTools() {
    return toolContext.loadToolsDefinitionsFromJson("json/data/mcp/tools.json");
  }

  protected List<McpSchema.Prompt> getPrompts() {
    return promptsContext.loadPromptsDefinitionsFromJson("json/data/mcp/prompts.json");
  }

  private void addStatelessTransport(
      MutableServletContextHandler contextHandler,
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

      // Create the appropriate authenticator based on the current auth provider.
      // LDAP uses LdapAuthenticator for credential validation via LDAP bind;
      // all other providers use BasicAuthenticator for DB-based validation.
      org.openmetadata.service.security.auth.AuthenticatorHandler credentialAuthenticator;
      org.openmetadata.schema.api.security.AuthenticationConfiguration currentAuthConfig =
          SecurityConfigurationManager.getCurrentAuthConfig();
      if (currentAuthConfig != null
          && currentAuthConfig.getProvider()
              == org.openmetadata.schema.services.connections.metadata.AuthProvider.LDAP) {
        credentialAuthenticator = new org.openmetadata.service.security.auth.LdapAuthenticator();
        credentialAuthenticator.init(config);
        LOG.info("LdapAuthenticator initialized for MCP OAuth credential validation");
      } else {
        credentialAuthenticator = new org.openmetadata.service.security.auth.BasicAuthenticator();
        credentialAuthenticator.init(config);
        LOG.info("BasicAuthenticator initialized for MCP OAuth credential validation");
      }

      org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider authProvider =
          new org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider(
              jwtGenerator, credentialAuthenticator);

      // Get allowed origins from MCP configuration (database-backed)
      List<String> allowedOrigins = getAllowedOriginsFromConfig();
      LOG.info("MCP OAuth CORS: Using allowed origins from configuration: {}", allowedOrigins);

      // Initialize OAuth token cleanup scheduler (runs hourly to delete expired tokens)
      OAuthTokenCleanupScheduler.initialize();
      environment
          .lifecycle()
          .manage(
              new io.dropwizard.lifecycle.Managed() {
                @Override
                public void start() {}

                @Override
                public void stop() {
                  OAuthTokenCleanupScheduler.shutdown();
                }
              });

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
              .serverInfo("openmetadata-mcp-stateless", "1.1.0")
              .capabilities(serverCapabilities)
              .build();
      addToolsToServer(server, tools);
      addPromptsToServer(server, prompts);

      // SSE transport for MCP
      ServletHolder servletHolderSSE = new ServletHolder(statelessOauthTransport);
      contextHandler.addServlet(servletHolderSSE, "/mcp/*");

      // Register Basic Auth / LDAP login handler with the transport provider.
      // The /mcp/* wildcard servlet intercepts all /mcp/ paths, so dedicated servlets at
      // /mcp/login can't be reached. Instead, the transport provider delegates internally.
      org.openmetadata.mcp.server.auth.handlers.BasicAuthLoginServlet basicAuthLoginServlet =
          new org.openmetadata.mcp.server.auth.handlers.BasicAuthLoginServlet(
              authProvider, credentialAuthenticator);
      statelessOauthTransport.setBasicAuthLoginServlet(basicAuthLoginServlet);
      LOG.info("Registered Basic Auth login handler in transport provider");

      // Register well-known filter via Dropwizard's environment.servlets() API.
      // This must use addFilter (not servlet registration) because the OpenMetadataAssetServlet
      // at "/*" treats all extension-less paths as SPA routes and serves index.html,
      // intercepting /.well-known/* before any exact-path servlet can handle it.
      // Filters registered via environment.servlets() run BEFORE any servlet processing.
      jakarta.servlet.FilterRegistration.Dynamic wellKnownFilter =
          environment
              .servlets()
              .addFilter("oauth-well-known", new OAuthWellKnownFilter(statelessOauthTransport));
      wellKnownFilter.addMappingForUrlPatterns(
          java.util.EnumSet.of(jakarta.servlet.DispatcherType.REQUEST), false, "/.well-known/*");
      LOG.info("OAuth well-known filter registered for /.well-known/* discovery paths");

      // Register SSO callback endpoint — only needed for SSO providers (Google, Azure, Okta).
      // If AuthenticationCodeFlowHandler isn't initialized (e.g., LDAP or Basic Auth),
      // skip the SSO callback servlet but keep everything else working.
      try {
        org.openmetadata.schema.api.security.AuthenticationConfiguration authConfig =
            SecurityConfigurationManager.getCurrentAuthConfig();
        // Only register SSO callback for actual SSO providers (not basic/ldap)
        if (authConfig == null
            || authConfig.getProvider() == null
            || authConfig.getProvider()
                == org.openmetadata.schema.services.connections.metadata.AuthProvider.BASIC
            || authConfig.getProvider()
                == org.openmetadata.schema.services.connections.metadata.AuthProvider.LDAP) {
          LOG.info(
              "Skipping SSO callback registration — auth provider is {}",
              authConfig != null ? authConfig.getProvider() : "null");
          throw new IllegalStateException("Non-SSO provider");
        }
        org.openmetadata.schema.auth.SSOAuthMechanism.SsoServiceType ssoServiceType;
        try {
          String providerStr = authConfig.getProvider().toString().toUpperCase();
          ssoServiceType =
              org.openmetadata.schema.auth.SSOAuthMechanism.SsoServiceType.valueOf(providerStr);
        } catch (Exception e) {
          ssoServiceType = org.openmetadata.schema.auth.SSOAuthMechanism.SsoServiceType.GOOGLE;
          LOG.info(
              "Using default SSO service type GOOGLE for provider: {}", authConfig.getProvider());
        }

        org.openmetadata.service.security.AuthenticationCodeFlowHandler ssoHandler =
            org.openmetadata.service.security.AuthenticationCodeFlowHandler.getInstance();
        org.openmetadata.mcp.server.auth.handlers.SSOCallbackServlet ssoCallbackServlet =
            new org.openmetadata.mcp.server.auth.handlers.SSOCallbackServlet(
                authProvider, ssoHandler, ssoServiceType, baseUrl);
        ServletHolder ssoCallbackHolder = new ServletHolder(ssoCallbackServlet);
        contextHandler.addServlet(ssoCallbackHolder, "/mcp/callback");

        // Register MCP state checker so AuthCallbackServlet can forward MCP callbacks.
        // SSO providers redirect to /callback (the registered URI), not /mcp/callback.
        // This checker lets /callback detect MCP flow and forward to /mcp/callback.
        org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository
            pendingAuthRepo =
                new org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository();
        org.openmetadata.service.security.AuthenticationCodeFlowHandler.setMcpStateChecker(
            state -> pendingAuthRepo.findByPac4jState(state) != null);
        LOG.info("Registered MCP state checker for SSO callback forwarding");

        LOG.info(
            "Registered SSO callback endpoint at /mcp/callback for provider: {}", ssoServiceType);
      } catch (Exception e) {
        LOG.info(
            "SSO callback servlet not registered (auth provider does not use SSO): {}",
            e.getMessage());
      }
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

  private String getMcpBotName() {
    if (mcpBotName == null) {
      try {
        AbstractNativeApplication mcpApp =
            ApplicationContext.getInstance().getAppIfExists(MCP_APP_NAME);
        if (mcpApp != null && mcpApp.getApp().getBot() != null) {
          mcpBotName = mcpApp.getApp().getBot().getName();
        }
        // Don't cache the default — if the app isn't registered yet, retry on next call
      } catch (Exception e) {
        LOG.debug("Could not resolve MCP bot name from app registry, will retry on next call", e);
      }
    }
    return mcpBotName != null ? mcpBotName : DEFAULT_MCP_BOT_NAME;
  }

  protected McpStatelessServerFeatures.SyncToolSpecification getTool(McpSchema.Tool tool) {
    return new McpStatelessServerFeatures.SyncToolSpecification(
        tool,
        (context, req) -> {
          try {
            CatalogSecurityContext securityContext =
                jwtFilter.getCatalogSecurityContext((String) context.get("Authorization"));
            ImpersonationContext.setImpersonatedBy(getMcpBotName());
            return toolContext.callTool(authorizer, limits, tool.name(), securityContext, req);
          } finally {
            ImpersonationContext.clear();
          }
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
          "Failed to get allowed origins from MCP config, CORS will reject all origins: {}",
          e.getMessage());
    }
    LOG.error(
        "MCP configuration not available. CORS will reject all origins. "
            + "Configure MCP settings via the API to enable cross-origin access.");
    return List.of();
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
    LOG.error(
        "No base URL configured in MCP settings or system settings. "
            + "Falling back to http://localhost:8585 — this is only suitable for local development. "
            + "Configure a proper base URL for production deployments.");
    return "http://localhost:8585";
  }
}
