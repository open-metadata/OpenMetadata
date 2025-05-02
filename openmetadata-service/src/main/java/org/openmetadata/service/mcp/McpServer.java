package org.openmetadata.service.mcp;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.dropwizard.setup.Environment;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import org.eclipse.jetty.servlet.ServletHolder;
import org.openmetadata.HttpServletSseServerTransportProvider;
import org.openmetadata.service.mcp.tools.SearchMetadataTool;
import org.openmetadata.service.mcp.tools.GreetingTool;

public class McpServer {
    public static void initializeMcpServer(Environment environment) {
        McpSchema.ServerCapabilities serverCapabilities =
                McpSchema.ServerCapabilities.builder()
                        .tools(true)
                        .prompts(true)
                        .resources(true, true)
                        .build();

        HttpServletSseServerTransportProvider transport =
                new HttpServletSseServerTransportProvider(new ObjectMapper(), "/mcp/message", "/mcp/sse");
        McpSyncServer server =
                io.modelcontextprotocol.server.McpServer.sync(transport)
                        .serverInfo("openmetadata-mcp", "0.1.0")
                        .capabilities(serverCapabilities)
                        .build();

        // Add resources, prompts, and tools to the MCP server
        server.addTool(SearchMetadataTool.tool());
        server.addTool(GreetingTool.tool());

        MutableServletContextHandler contextHandler = environment.getApplicationContext();
        ServletHolder servletHolder = new ServletHolder(transport);
        contextHandler.addServlet(servletHolder, "/mcp/*");
    }
}
