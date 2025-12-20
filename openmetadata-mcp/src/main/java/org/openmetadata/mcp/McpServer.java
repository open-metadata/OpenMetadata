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
import org.eclipse.jetty.ee10.servlet.FilterHolder;
import org.eclipse.jetty.ee10.servlet.ServletHolder;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.server.auth.Constants;
import org.openmetadata.mcp.server.auth.provider.OpenMetadataAuthProvider;
import org.openmetadata.mcp.server.auth.settings.ClientRegistrationOptions;
import org.openmetadata.mcp.server.auth.settings.RevocationOptions;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.schema.utils.JsonUtils;
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
              .logging()
              .build();
      //          HttpServletStatelessServerTransport statelessTransport =
      //                  HttpServletStatelessServerTransport.builder()
      //                          .jsonMapper(new JacksonMcpJsonMapper(JsonUtils.getObjectMapper()))
      //                          .messageEndpoint("/mcp")
      //                          .contextExtractor(new AuthEnrichedMcpContextExtractor())
      //                          .build();
      OAuthClientInformation clientInfo = new OAuthClientInformation();
      clientInfo.setClientId("0b8552fb-4ecc-47d7-8f5d-eaa47a42685f");
      clientInfo.setClientSecret(
          SecurityConfigurationManager.getCurrentAuthConfig().getOidcConfiguration().getSecret());
      clientInfo.setRedirectUris(Collections.singletonList(new URI(Constants.REDIRECT_URI)));
      clientInfo.setTokenEndpointAuthMethod("client_secret_post");
      clientInfo.setGrantTypes(Arrays.asList("authorization_code", "refresh_token"));
      clientInfo.setResponseTypes(Collections.singletonList("code"));
      clientInfo.setScope(Constants.SCOPE);

      // Create auth provider that integrates with OpenMetadata's existing SSO system
      String baseUrl = "http://localhost:8585";
      OpenMetadataAuthProvider authProvider = new OpenMetadataAuthProvider(baseUrl);
      authProvider.registerClient(clientInfo).get();

      // Create registration options
      ClientRegistrationOptions registrationOptions = new ClientRegistrationOptions();
      registrationOptions.setAllowLocalhostRedirect(true);
      registrationOptions.setValidScopes(
          Arrays.asList(
              "openid",
              "profile",
              "email",
              "offline_access",
              "api://0a957c01-29f8-4fce-a1dc-3b9f12447b60/.default"));

      // Create revocation options
      RevocationOptions revocationOptions = new RevocationOptions();
      revocationOptions.setEnabled(true);

      OAuthHttpStatelessServerTransportProvider statelessOauthTransport =
          new OAuthHttpStatelessServerTransportProvider(
              JsonUtils.getObjectMapper(),
              baseUrl,
              "/mcp",
              new AuthEnrichedMcpContextExtractor(),
              authProvider,
              registrationOptions,
              revocationOptions);
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

      // Register MCP OAuth callback servlet
      //      McpOAuthCallbackServlet callbackServlet = new McpOAuthCallbackServlet(authProvider);
      //      ServletHolder callbackHolder = new ServletHolder(callbackServlet);
      //      contextHandler.addServlet(callbackHolder, "/mcp/auth/callback");
      //      LOG.info("Registered MCP OAuth callback servlet at mcp/auth/callback");

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
}
