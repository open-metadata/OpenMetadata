package org.openmetadata.service.mcp;

import static org.openmetadata.service.mcp.McpUtils.callTool;
import static org.openmetadata.service.mcp.McpUtils.getToolProperties;

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
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class McpServer {
  private JwtFilter jwtFilter;
  private Authorizer authorizer;
  private Limits limits;

  public McpServer() {}

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
    List<McpSchema.Tool> tools = loadToolsDefinitionsFromJson();
    addSSETransport(contextHandler, authFilter, tools);
    addStreamableHttpServlet(contextHandler, authFilter, tools);
  }

  private void addSSETransport(
      MutableServletContextHandler contextHandler,
      McpAuthFilter authFilter,
      List<McpSchema.Tool> tools) {
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

    // SSE transport for MCP
    ServletHolder servletHolderSSE = new ServletHolder(sseTransport);
    contextHandler.addServlet(servletHolderSSE, "/mcp/*");

    contextHandler.addFilter(
        new FilterHolder(authFilter), "/mcp/*", EnumSet.of(DispatcherType.REQUEST));
  }

  private void addStreamableHttpServlet(
      MutableServletContextHandler contextHandler,
      McpAuthFilter authFilter,
      List<McpSchema.Tool> tools) {
    // Streamable HTTP servlet for MCP
    MCPStreamableHttpServlet streamableHttpServlet =
        new MCPStreamableHttpServlet(jwtFilter, authorizer, limits, tools);
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

  protected List<McpSchema.Tool> loadToolsDefinitionsFromJson() {
    return getToolProperties("json/data/mcp/tools.json");
  }

  private McpServerFeatures.SyncToolSpecification getTool(McpSchema.Tool tool) {
    return new McpServerFeatures.SyncToolSpecification(
        tool,
        (exchange, arguments) -> {
          McpSchema.Content content =
              new McpSchema.TextContent(
                  JsonUtils.pojoToJson(
                      callTool(authorizer, jwtFilter, limits, tool.name(), arguments)));
          return new McpSchema.CallToolResult(List.of(content), false);
        });
  }
}
