package org.openmetadata.mcp;

import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.server.transport.HttpServletStatelessServerTransport;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.DispatcherType;
import java.util.EnumSet;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.ServletHolder;
import org.openmetadata.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.mcp.tools.DefaultToolContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.McpServerProvider;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

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
        new JwtFilter(config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration());
    this.authorizer = authorizer;
    this.limits = limits;
    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    McpAuthFilter authFilter =
        new McpAuthFilter(
            new JwtFilter(
                config.getAuthenticationConfiguration(), config.getAuthorizerConfiguration()));
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
    McpSchema.ServerCapabilities serverCapabilities =
        McpSchema.ServerCapabilities.builder()
            .tools(true)
            .prompts(true)
            .resources(true, true)
            .logging()
            .build();

    HttpServletStatelessServerTransport statelessTransport =
        HttpServletStatelessServerTransport.builder()
            .objectMapper(JsonUtils.getObjectMapper())
            .messageEndpoint("/mcp")
            .contextExtractor(new AuthEnrichedMcpContextExtractor())
            .build();

    McpStatelessSyncServer server =
        io.modelcontextprotocol.server.McpServer.sync(statelessTransport)
            .serverInfo("openmetadata-mcp-stateless", "0.11.2")
            .capabilities(serverCapabilities)
            .build();
    addToolsToServer(server, tools);
    addPromptsToServer(server, prompts);

    // SSE transport for MCP
    ServletHolder servletHolderSSE = new ServletHolder(statelessTransport);
    contextHandler.addServlet(servletHolderSSE, "/mcp/*");

    contextHandler.addFilter(
        new FilterHolder(authFilter), "/mcp/*", EnumSet.of(DispatcherType.REQUEST));
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
          McpSchema.Content content =
              new McpSchema.TextContent(
                  JsonUtils.pojoToJson(
                      toolContext.callTool(authorizer, limits, tool.name(), securityContext, req)));
          return new McpSchema.CallToolResult(List.of(content), false);
        });
  }

  private McpStatelessServerFeatures.SyncPromptSpecification getPrompt(McpSchema.Prompt prompt) {
    return new McpStatelessServerFeatures.SyncPromptSpecification(
        prompt,
        (exchange, arguments) ->
            promptsContext.callPrompt(jwtFilter, prompt.name(), arguments).getResult());
  }
}
