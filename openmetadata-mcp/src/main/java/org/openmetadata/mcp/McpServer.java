package org.openmetadata.mcp;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.server.McpSyncListFilter;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpStatelessServerTransport;
import jakarta.servlet.DispatcherType;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.server.auth.handlers.BasicAuthLoginServlet;
import org.openmetadata.mcp.server.auth.jobs.OAuthTokenCleanupScheduler;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.util.UriUtils;
import org.openmetadata.mcp.server.transport.JsonRpcErrorBody;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.mcp.usage.McpUsageRecorder;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.ApplicationContext;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;
import org.openmetadata.service.apps.bundles.mcp.McpToolRegistry;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;
import org.openmetadata.service.util.PerRequestContextCleaner;

@Slf4j
public class McpServer implements McpServerProvider {
  private static final String DEFAULT_MCP_BOT_NAME = McpAppConstants.MCP_APP_NAME + "Bot";

  protected volatile JwtFilter jwtFilter;
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
    // Tokens must be checked against the security settings in effect, which reload without a
    // restart.
    SecurityConfigurationManager.getInstance()
        .addConfigurationChangeListener(
            (authConfig, authzConfig, mcpConfig) ->
                this.jwtFilter = new JwtFilter(authConfig, authzConfig));
    this.authorizer = authorizer;
    this.limits = limits;
    this.environment = environment;
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    List<McpSchema.Tool> tools = getTools();
    McpToolRegistry.setToolNames(tools.stream().map(McpSchema.Tool::name).toList());
    logToolGating(tools, SecurityConfigurationManager.getCurrentMcpConfig());
    SecurityConfigurationManager.getInstance()
        .addConfigurationChangeListener(
            (authConfig, authzConfig, mcpConfig) -> logToolGating(tools, mcpConfig));
    List<McpSchema.Prompt> prompts = getPrompts();
    addStatelessTransport(contextHandler, tools, prompts);
  }

  /**
   * Advertises only the features this server can actually handle.
   *
   * <p>Clients trust what we advertise and call it. If we claim a capability we have no handler for,
   * the call comes back as MethodNotFound. So: no logging, because there is no logging/setLevel
   * handler (VSCode used to call it), and no resources, because no resources are registered here.
   * The resources flag would also advertise resources/subscribe, which protocol 2026-07-28 has
   * replaced with subscriptions/listen. listChanged is false: a stateless server cannot send
   * notifications/tools/list_changed, so a client sees a changed list when it lists again.
   */
  protected McpSchema.ServerCapabilities buildServerCapabilities() {
    return McpSchema.ServerCapabilities.builder().tools(false).prompts(false).build();
  }

  /**
   * Tools that cannot work without a live triplestore, and are therefore withheld when RDF is off.
   *
   * <p>{@code ontology_describe} is deliberately absent: its default path serves the bundled
   * ontology document straight off the classpath and works with RDF disabled.
   */
  private static final Set<String> RDF_DEPENDENT_TOOLS =
      Set.of("sparql_query", "entity_neighborhood", "find_by_tag", "shacl_validate");

  private static final Set<String> WRITE_HELPER_TOOLS = Set.of("describe_entity_type");

  /**
   * Advertises the knowledge-graph tools only where they can actually run.
   *
   * <p>{@code rdf.enabled} defaults to false, so on a stock deployment these tools were listed to
   * every client and then failed on every call. That contradicts the rule stated on {@link
   * #buildServerCapabilities()} - clients trust what we advertise and call it - and it spends the
   * model's context on four tool schemas that cannot succeed. RDF is initialized during core
   * infrastructure startup, well before MCP registration, so the repository state is already settled
   * by the time this runs.
   */
  protected List<McpSchema.Tool> getTools() {
    List<McpSchema.Tool> tools =
        toolContext.loadToolsDefinitionsFromJson("json/data/mcp/tools.json");
    if (rdfEnabled()) {
      return tools;
    }
    List<McpSchema.Tool> available =
        tools.stream().filter(tool -> !RDF_DEPENDENT_TOOLS.contains(tool.name())).toList();
    LOG.info(
        "[MCP] RDF is disabled; withholding {} knowledge-graph tool(s) from tools/list",
        tools.size() - available.size());
    return available;
  }

  private static boolean rdfEnabled() {
    RdfRepository repository = RdfRepository.getInstanceOrNull();
    return repository != null && repository.isEnabled();
  }

  /**
   * Read-only mode and disabled tools, for every caller including admins, whom no policy can deny.
   * Every tool is registered at startup, after a subclass has added its own in {@link #getTools()};
   * this filter hides the refused ones on each tools/list from the setting as it is now, and {@link
   * #executeTool} refuses them on each call. See ADR:2026-11-04-mcp-read-only-mode-hides-write-tools
   * and ADR:2026-11-05-mcp-admins-can-disable-single-tools.
   */
  static McpSyncListFilter<McpSchema.Tool> toolFilter(Supplier<MCPConfiguration> config) {
    return (context, tool) -> refusalReason(tool, config.get()).isEmpty();
  }

  static McpStatelessSyncServer buildServer(
      McpStatelessServerTransport transport,
      McpSchema.ServerCapabilities capabilities,
      Supplier<MCPConfiguration> mcpConfig) {
    return io.modelcontextprotocol.server.McpServer.sync(transport)
        .serverInfo(serverInfo(mcpConfig.get()))
        .capabilities(capabilities)
        // SDK 2.x checks tools/call arguments against the tool schema by default. Kept off: the
        // tools accept looser shapes on purpose, see
        // ADR:2026-11-06-mcp-tool-arguments-are-coerced-by-tools-not-validated-by-the-sdk.
        .validateToolInputs(false)
        .addToolFilter(toolFilter(mcpConfig))
        .build();
  }

  // The name and version clients see in initialize come from the MCP settings, read at startup. A
  // blank value falls back to the schema default: the SDK refuses a server without them.
  static McpSchema.Implementation serverInfo(MCPConfiguration config) {
    MCPConfiguration defaults = new MCPConfiguration();
    MCPConfiguration current = config == null ? defaults : config;
    return McpSchema.Implementation.builder(
            textOr(current.getMcpServerName(), defaults.getMcpServerName()),
            textOr(current.getMcpServerVersion(), defaults.getMcpServerVersion()))
        .build();
  }

  private static String textOr(String value, String fallback) {
    return value == null || value.isBlank() ? fallback : value;
  }

  // tools/list follows the setting live, so say what it hides each time the setting loads.
  private static void logToolGating(List<McpSchema.Tool> tools, MCPConfiguration config) {
    long hidden = tools.stream().filter(tool -> refusalReason(tool, config).isPresent()).count();
    if (hidden > 0) {
      LOG.info(
          "[MCP] Read-only mode and disabled tools hide {} of {} tool(s) from tools/list",
          hidden,
          tools.size());
    }
    warnAboutUnknownTools(tools, disabledTools(config));
  }

  // Not an error: the name may be a tool of another distribution or one renamed on upgrade.
  private static void warnAboutUnknownTools(List<McpSchema.Tool> registered, Set<String> disabled) {
    Set<String> names = registered.stream().map(McpSchema.Tool::name).collect(Collectors.toSet());
    List<String> unknown = disabled.stream().filter(name -> !names.contains(name)).toList();
    if (!unknown.isEmpty()) {
      LOG.warn("[MCP] Ignoring disabled tool name(s) that match no registered tool: {}", unknown);
    }
  }

  private static boolean isReadOnlyMode(MCPConfiguration config) {
    return config != null && Boolean.TRUE.equals(config.getReadOnly());
  }

  private static Set<String> disabledTools(MCPConfiguration config) {
    return config == null || config.getDisabledTools() == null
        ? Set.of()
        : config.getDisabledTools();
  }

  // The MCP spec defaults readOnlyHint to false, so a tool without it counts as a write tool.
  // describe_entity_type only reads, but it exists to prepare a create_entity call.
  private static boolean isAvailableInReadOnlyMode(McpSchema.Tool tool) {
    boolean readOnlyHint =
        tool.annotations() != null && Boolean.TRUE.equals(tool.annotations().readOnlyHint());
    return readOnlyHint && !WRITE_HELPER_TOOLS.contains(tool.name());
  }

  private static Optional<String> refusalReason(McpSchema.Tool tool, MCPConfiguration config) {
    Optional<String> reason = Optional.empty();
    if (isReadOnlyMode(config) && !isAvailableInReadOnlyMode(tool)) {
      reason =
          Optional.of("The MCP server is in read-only mode, so " + tool.name() + " is unavailable");
    } else if (disabledTools(config).contains(tool.name())) {
      reason = Optional.of(tool.name() + " is disabled on this MCP server");
    }
    return reason;
  }

  protected List<McpSchema.Prompt> getPrompts() {
    return promptsContext.loadPromptsDefinitionsFromJson("json/data/mcp/prompts.json");
  }

  private void addStatelessTransport(
      MutableServletContextHandler contextHandler,
      List<McpSchema.Tool> tools,
      List<McpSchema.Prompt> prompts) {
    try {
      McpSchema.ServerCapabilities serverCapabilities = buildServerCapabilities();
      // Create unified OAuth provider for MCP authentication (supports both SSO and Basic Auth)
      // Get base URL from MCP configuration or system settings
      String baseUrl = UriUtils.withoutTrailingSlash(getBaseUrlFromConfig());
      LOG.info("MCP OAuth initialized with base URL: {}", baseUrl);
      OAuthHttpStatelessServerTransportProvider.warnIfBaseUrlMissesContextPath(
          baseUrl, contextHandler.getContextPath());

      org.openmetadata.service.security.jwt.JWTTokenGenerator jwtGenerator =
          org.openmetadata.service.security.jwt.JWTTokenGenerator.getInstance();

      UserSSOOAuthProvider authProvider = new UserSSOOAuthProvider(jwtGenerator);

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
      statelessOauthTransport.setContextPath(contextHandler.getContextPath());
      McpStatelessSyncServer server =
          buildServer(
              statelessOauthTransport,
              serverCapabilities,
              SecurityConfigurationManager::getCurrentMcpConfig);
      addToolsToServer(server, tools);
      addPromptsToServer(server, prompts);

      // SSE transport for MCP
      ServletHolder servletHolderSSE = new ServletHolder(statelessOauthTransport);
      contextHandler.addServlet(servletHolderSSE, "/mcp/*");

      // Register Basic Auth / LDAP login handler with the transport provider.
      // The /mcp/* wildcard servlet intercepts all /mcp/ paths, so dedicated servlets at
      // /mcp/login can't be reached. Instead, the transport provider delegates internally.
      BasicAuthLoginServlet basicAuthLoginServlet = new BasicAuthLoginServlet(authProvider);
      statelessOauthTransport.setBasicAuthLoginServlet(basicAuthLoginServlet);
      LOG.info("Registered Basic Auth login handler in transport provider");

      registerAvailabilityFilter(environment);

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

      // Register MCP state checker so AuthCallbackServlet can forward MCP callbacks.
      // SSO providers redirect to /callback (the registered URI), not /mcp/callback.
      // This checker lets /callback detect MCP flow and forward to /mcp/callback.
      org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository pendingAuthRepo =
          new org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository();
      org.openmetadata.service.security.AuthenticationCodeFlowHandler.setMcpStateChecker(
          state -> pendingAuthRepo.findByPac4jState(state) != null);
      LOG.info("Registered MCP state checker for SSO callback forwarding");

      // Register the persister so handleLogin() links the OIDC round-trip state to the MCP pending
      // request before it redirects to the provider, keeping the returning /callback resolvable.
      org.openmetadata.service.security.AuthenticationCodeFlowHandler.setMcpPendingStatePersister(
          (request, state, nonce, codeVerifier) -> {
            jakarta.servlet.http.HttpSession session = request.getSession(false);
            Object authRequestId =
                session == null
                    ? null
                    : session.getAttribute(
                        org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider
                            .MCP_AUTH_REQUEST_ID);
            if (authRequestId instanceof String id) {
              pendingAuthRepo.updatePac4jSession(id, state, nonce, codeVerifier);
              request.setAttribute(
                  org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider.MCP_STATE_LINKED,
                  Boolean.TRUE);
            } else {
              LOG.warn(
                  "MCP pending-state persister could not resolve {} from the session; "
                      + "the returning /callback will not match a pending request",
                  org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider
                      .MCP_AUTH_REQUEST_ID);
            }
          });
      LOG.info("Registered MCP pending-state persister for OIDC round-trip linking");

      // Register the SAML MCP bridge so the SAML ACS callback (service module) can hand the
      // authenticated identity back to the MCP OAuth flow. SAML carries the MCP authorization
      // request id in RelayState ("mcp:{authRequestId}"); SamlAuthServletHandler detects it and
      // invokes this handler, which asks the user to approve the client before a code is minted.
      // The SAML ACS is not under /mcp/, so it checks availability itself.
      org.openmetadata.service.security.auth.SamlAuthServletHandler.setMcpSamlCallbackHandler(
          (req, resp, username, email, relayState) -> {
            if (McpAvailabilityFilter.isMcpAvailable()) {
              authProvider.handleSSOCallbackWithDbState(req, resp, username, email, relayState);
            } else {
              McpAvailabilityFilter.refuse(resp);
            }
          });
      LOG.info("Registered MCP SAML callback handler for SAML SSO support");

      // Register MCP callback servlet unconditionally — SSO availability is checked at
      // request time, not startup time. This follows the same pattern as the regular auth
      // servlets (AuthCallbackServlet, AuthLoginServlet) which are always registered and
      // dispatch to the appropriate handler at runtime.
      contextHandler.addServlet(
          new ServletHolder(
              new org.openmetadata.mcp.server.auth.handlers.McpCallbackServlet(authProvider)),
          "/mcp/callback");
      LOG.info("Registered /mcp/callback servlet (runtime SSO dispatch)");
    } catch (Exception ex) {
      LOG.error(
          "[MCP] Initialization failed partway: the /mcp endpoint, or the OAuth routes registered "
              + "after it, are missing, so MCP clients may not connect. Check the configuration "
              + "and restart.",
          ex);
    }
  }

  /** FORWARD covers the SSO callback, which /callback forwards to /mcp/callback. */
  private static void registerAvailabilityFilter(Environment environment) {
    environment
        .servlets()
        .addFilter("mcp-availability", new McpAvailabilityFilter())
        .addMappingForUrlPatterns(
            EnumSet.of(DispatcherType.REQUEST, DispatcherType.FORWARD), false, "/mcp/*");
  }

  public void addToolsToServer(McpStatelessSyncServer server, List<McpSchema.Tool> tools) {
    for (McpSchema.Tool tool : tools) {
      registerTool(server, tool);
    }
  }

  // SDK 2.x rejects a tool whose inputSchema is not valid JSON Schema 2020-12. Skip that one tool
  // rather than let the exception take down the whole /mcp endpoint.
  private void registerTool(McpStatelessSyncServer server, McpSchema.Tool tool) {
    try {
      server.addTool(getTool(tool));
    } catch (IllegalArgumentException e) {
      LOG.error("[MCP] Skipping tool '{}': {}", tool.name(), e.getMessage());
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
            ApplicationContext.getInstance().getAppIfExists(McpAppConstants.MCP_APP_NAME);
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
        tool, (context, req) -> runCallback(tool.name(), () -> executeTool(tool, context, req)));
  }

  private McpSchema.CallToolResult executeTool(
      McpSchema.Tool tool, McpTransportContext context, McpSchema.CallToolRequest req) {
    CatalogSecurityContext securityContext = securityContextFrom(context);
    String userName = securityContext.getUserPrincipal().getName();
    String clientName = (String) context.get(AuthEnrichedMcpContextExtractor.CLIENT_NAME);
    DefaultToolContext.CallToolOutcome outcome = null;
    try {
      ImpersonationContext.setImpersonatedBy(getMcpBotName());
      outcome =
          refusalReason(tool, SecurityConfigurationManager.getCurrentMcpConfig())
              .map(DefaultToolContext::forbidden)
              .orElseGet(
                  () ->
                      toolContext.callToolWithMetadata(
                          authorizer, limits, tool.name(), securityContext, req));
      return outcome.result();
    } finally {
      recordUsage(tool.name(), userName, clientName, outcome);
    }
  }

  private void recordUsage(
      String toolName,
      String userName,
      String clientName,
      DefaultToolContext.CallToolOutcome outcome) {
    boolean success = outcome != null && !Boolean.TRUE.equals(outcome.result().isError());
    Long latencyMs = outcome != null ? outcome.latencyMs() : null;
    McpToolCallUsage.ErrorCategory category = outcome != null ? outcome.errorCategory() : null;
    McpUsageRecorder.record(toolName, userName, success, latencyMs, category, clientName);
  }

  McpStatelessServerFeatures.SyncPromptSpecification getPrompt(McpSchema.Prompt prompt) {
    return new McpStatelessServerFeatures.SyncPromptSpecification(
        prompt,
        (context, arguments) ->
            runCallback(
                prompt.name(),
                () ->
                    promptsContext.callPrompt(
                        securityContextFrom(context), prompt.name(), arguments)));
  }

  /** Tools and prompts both resolve the caller from the request headers, never from the body. */
  private CatalogSecurityContext securityContextFrom(McpTransportContext context) {
    String token = (String) context.get(AuthEnrichedMcpContextExtractor.AUTHORIZATION_HEADER);
    String activePersona =
        (String) context.get(AuthEnrichedMcpContextExtractor.ACTIVE_PERSONA_HEADER);
    return activePersona == null
        ? jwtFilter.getCatalogSecurityContext(token)
        : jwtFilter.getCatalogSecurityContext(token, activePersona);
  }

  /**
   * The SDK runs each callback on a Reactor bounded-elastic worker that outlives the call, so the
   * entity cache and impersonation state a call leaves on its thread would otherwise answer the
   * next call that lands there. A servlet filter cannot clear them: it runs on a different thread.
   *
   * <p>The SDK answers an exception that is not an {@link McpError} with -32603 and the
   * exception's own message. A token the server could not confirm becomes an {@link McpError} that
   * reads as temporarily unavailable, without that message, which names the principal.
   */
  private static <T> T runCallback(String name, Supplier<T> callback) {
    PerRequestContextCleaner.clear();
    try {
      return callback.get();
    } catch (CredentialUnavailableException e) {
      LOG.debug("MCP callback token could not be confirmed", e);
      throw McpError.builder(JsonRpcErrorBody.UNAVAILABLE)
          .message(CredentialUnavailableException.CLIENT_MESSAGE)
          .build();
    } catch (VirtualMachineError | LinkageError e) {
      // Reactor treats these as fatal: it drops them on the worker instead of failing the call, so
      // the request waiting for the reply would hold its thread until the server restarts. The
      // name is logged because a stack overflow's trace keeps only the deepest frames.
      LOG.error("MCP callback {} failed", name, e);
      throw McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
          .message("The server could not complete this call")
          .build();
    } finally {
      PerRequestContextCleaner.clear();
    }
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
