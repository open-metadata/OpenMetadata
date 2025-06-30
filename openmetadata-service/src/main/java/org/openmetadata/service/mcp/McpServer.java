package org.openmetadata.service.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.DispatcherType;
import java.util.EnumSet;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.servlet.FilterHolder;
import org.eclipse.jetty.servlet.ServletHolder;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.service.mcp.tools.DefaultToolContext;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;

@Slf4j
public class McpServer {
  private JwtFilter jwtFilter;
  private Authorizer authorizer;
  private Limits limits;
  protected DefaultToolContext toolContext;
  protected DefaultPromptsContext promptsContext;

  public McpServer(DefaultToolContext toolContext, DefaultPromptsContext promptsContext) {
    this.toolContext = toolContext;
    this.promptsContext = promptsContext;
  }

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
    addSSETransport(contextHandler, authFilter, tools, prompts);
    addStreamableHttpServlet(contextHandler, authFilter, tools, prompts);
  }

  protected List<McpSchema.Tool> getTools() {
    return toolContext.loadToolsDefinitionsFromJson("json/data/mcp/tools.json");
  }

  protected List<McpSchema.Prompt> getPrompts() {
    return promptsContext.loadPromptsDefinitionsFromJson("json/data/mcp/prompts.json");
  }

  private void addSSETransport(
      MutableServletContextHandler contextHandler,
      McpAuthFilter authFilter,
      List<McpSchema.Tool> tools,
      List<McpSchema.Prompt> prompts) {
    McpSchema.ServerCapabilities serverCapabilities =
        McpSchema.ServerCapabilities.builder()
            .tools(true)
            .prompts(true)
            .resources(true, true)
            .build();

    HttpServletSseServerTransportProvider sseTransport =
        new HttpServletSseServerTransportProvider(new ObjectMapper(), "/mcp/messages", "/mcp/sse");

    McpSyncServer server =
        io.modelcontextprotocol.server.McpServer.sync(sseTransport)
            .serverInfo("openmetadata-mcp-sse", "0.1.0")
            .capabilities(serverCapabilities)
            .build();
    addToolsToServer(server, tools);
    addPromptsToServer(server, prompts);

    // SSE transport for MCP
    ServletHolder servletHolderSSE = new ServletHolder(sseTransport);
    contextHandler.addServlet(servletHolderSSE, "/mcp/*");

    contextHandler.addFilter(
        new FilterHolder(authFilter), "/mcp/*", EnumSet.of(DispatcherType.REQUEST));
  }

  private void addStreamableHttpServlet(
      MutableServletContextHandler contextHandler,
      McpAuthFilter authFilter,
      List<McpSchema.Tool> tools,
      List<McpSchema.Prompt> prompts) {
    // Streamable HTTP servlet for MCP
    MCPStreamableHttpServlet streamableHttpServlet =
        new MCPStreamableHttpServlet(
            jwtFilter, authorizer, limits, toolContext, promptsContext, tools, prompts);
    ServletHolder servletHolderStreamableHttp = new ServletHolder(streamableHttpServlet);
    contextHandler.addServlet(servletHolderStreamableHttp, "/mcp");

    contextHandler.addFilter(
        new FilterHolder(authFilter), "/mcp", EnumSet.of(DispatcherType.REQUEST));
  }

  public void addToolsToServer(McpSyncServer server, List<McpSchema.Tool> tools) {
    for (McpSchema.Tool tool : tools) {
      server.addTool(getTool(tool));
    }
  }

  public void addPromptsToServer(McpSyncServer server, List<McpSchema.Prompt> tools) {
    for (McpSchema.Prompt pm : tools) {
      server.addPrompt(getPrompt(pm));
    }
  }

  private McpServerFeatures.SyncToolSpecification getTool(McpSchema.Tool tool) {
    return new McpServerFeatures.SyncToolSpecification(
        tool,
        (exchange, arguments) -> {
          McpSchema.Content content =
              new McpSchema.TextContent(
                  JsonUtils.pojoToJson(
                      toolContext.callTool(authorizer, jwtFilter, limits, tool.name(), arguments)));
          return new McpSchema.CallToolResult(List.of(content), false);
        });
  }

  private McpServerFeatures.SyncPromptSpecification getPrompt(McpSchema.Prompt prompt) {
    return new McpServerFeatures.SyncPromptSpecification(
        prompt,
        (exchange, arguments) ->
            promptsContext.callPrompt(jwtFilter, prompt.name(), arguments).getResult());
  }
}
