/*
 * Copyright 2024-2024 the original author or authors.
 */

package org.openmetadata.mcp.server.transport;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.server.DefaultMcpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerHandler;
import io.modelcontextprotocol.server.McpTransportContext;
import io.modelcontextprotocol.server.McpTransportContextExtractor;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpStatelessServerTransport;
import io.modelcontextprotocol.util.Assert;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import org.openmetadata.mcp.server.auth.middleware.AuthContext;
import org.openmetadata.mcp.server.auth.middleware.AuthContextProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;

/**
 * Implementation of an HttpServlet based {@link McpStatelessServerTransport}.
 *
 * @author Christian Tzolov
 * @author Dariusz Jędrzejczyk
 */
@WebServlet(asyncSupported = true)
public class HttpServletStatelessServerTransport extends HttpServlet
    implements McpStatelessServerTransport, AuthContextProvider {

  private static final Logger logger =
      LoggerFactory.getLogger(HttpServletStatelessServerTransport.class);

  public static final String UTF_8 = "UTF-8";

  public static final String APPLICATION_JSON = "application/json";

  public static final String TEXT_EVENT_STREAM = "text/event-stream";

  public static final String ACCEPT = "Accept";

  public static final String FAILED_TO_SEND_ERROR_RESPONSE = "Failed to send error response: {}";

  private final ObjectMapper objectMapper;

  private final String mcpEndpoint;

  private McpStatelessServerHandler mcpHandler;

  private McpTransportContextExtractor<HttpServletRequest> contextExtractor;

  private volatile boolean isClosing = false;

  private AuthContext authContext;

  HttpServletStatelessServerTransport(
      ObjectMapper objectMapper,
      String mcpEndpoint,
      McpTransportContextExtractor<HttpServletRequest> contextExtractor) {
    Assert.notNull(objectMapper, "objectMapper must not be null");
    Assert.notNull(mcpEndpoint, "mcpEndpoint must not be null");
    Assert.notNull(contextExtractor, "contextExtractor must not be null");

    this.objectMapper = objectMapper;
    this.mcpEndpoint = mcpEndpoint;
    this.contextExtractor = contextExtractor;
  }

  @Override
  public void setAuthContext(AuthContext authContext) {
    this.authContext = authContext;
  }

  @Override
  public AuthContext getAuthContext() {
    return authContext;
  }

  @Override
  public void setMcpHandler(McpStatelessServerHandler mcpHandler) {
    this.mcpHandler = mcpHandler;
  }

  @Override
  public Mono<Void> closeGracefully() {
    return Mono.fromRunnable(() -> this.isClosing = true);
  }

  /**
   * Handles GET requests - returns 405 METHOD NOT ALLOWED as stateless transport
   * doesn't support GET requests.
   * @param request The HTTP servlet request
   * @param response The HTTP servlet response
   * @throws ServletException If a servlet-specific error occurs
   * @throws IOException If an I/O error occurs
   */
  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    this.doPost(request, response);
    //    String requestURI = request.getRequestURI();
    //    if (!requestURI.endsWith(mcpEndpoint)) {
    //      response.sendError(HttpServletResponse.SC_NOT_FOUND);
    //      return;
    //    }
    //
    //    response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
  }

  /**
   * Handles POST requests for incoming JSON-RPC messages from clients.
   * @param request The HTTP servlet request containing the JSON-RPC message
   * @param response The HTTP servlet response
   * @throws ServletException If a servlet-specific error occurs
   * @throws IOException If an I/O error occurs
   */
  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    String requestURI = request.getRequestURI();
    if (!requestURI.endsWith(mcpEndpoint)) {
      response.sendError(HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    if (isClosing) {
      response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Server is shutting down");
      return;
    }

    if (!authenticateRequest(request, response)) {
      return; // Authentication failed, response already set
    }

    McpTransportContext transportContext =
        this.contextExtractor.extract(request, new DefaultMcpTransportContext());

    String accept = request.getHeader(ACCEPT);
    if (accept == null
        || !(accept.contains(APPLICATION_JSON) && accept.contains(TEXT_EVENT_STREAM))) {
      this.responseError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          new McpError("Both application/json and text/event-stream required in Accept header"));
      return;
    }

    try {
      BufferedReader reader = request.getReader();
      StringBuilder body = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) {
        body.append(line);
      }

      McpSchema.JSONRPCMessage message =
          McpSchema.deserializeJsonRpcMessage(objectMapper, body.toString());

      if (message instanceof McpSchema.JSONRPCRequest jsonrpcRequest) {
        try {
          McpSchema.JSONRPCResponse jsonrpcResponse =
              this.mcpHandler
                  .handleRequest(transportContext, jsonrpcRequest)
                  .contextWrite(ctx -> ctx.put(McpTransportContext.KEY, transportContext))
                  .block();

          response.setContentType(APPLICATION_JSON);
          response.setCharacterEncoding(UTF_8);
          response.setStatus(HttpServletResponse.SC_OK);

          String jsonResponseText = objectMapper.writeValueAsString(jsonrpcResponse);
          PrintWriter writer = response.getWriter();
          writer.write(jsonResponseText);
          writer.flush();
        } catch (Exception e) {
          logger.error("Failed to handle request: {}", e.getMessage());
          this.responseError(
              response,
              HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
              new McpError("Failed to handle request: " + e.getMessage()));
        }
      } else if (message instanceof McpSchema.JSONRPCNotification jsonrpcNotification) {
        try {
          this.mcpHandler
              .handleNotification(transportContext, jsonrpcNotification)
              .contextWrite(ctx -> ctx.put(McpTransportContext.KEY, transportContext))
              .block();
          response.setStatus(HttpServletResponse.SC_ACCEPTED);
        } catch (Exception e) {
          logger.error("Failed to handle notification: {}", e.getMessage());
          this.responseError(
              response,
              HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
              new McpError("Failed to handle notification: " + e.getMessage()));
        }
      } else {
        this.responseError(
            response,
            HttpServletResponse.SC_BAD_REQUEST,
            new McpError("The server accepts either requests or notifications"));
      }
    } catch (IllegalArgumentException | IOException e) {
      logger.error("Failed to deserialize message: {}", e.getMessage());
      this.responseError(
          response, HttpServletResponse.SC_BAD_REQUEST, new McpError("Invalid message format"));
    } catch (Exception e) {
      logger.error("Unexpected error handling message: {}", e.getMessage());
      this.responseError(
          response,
          HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
          new McpError("Unexpected error: " + e.getMessage()));
    }
  }

  /**
   * Sends an error response to the client.
   * @param response The HTTP servlet response
   * @param httpCode The HTTP status code
   * @param mcpError The MCP error to send
   * @throws IOException If an I/O error occurs
   */
  private void responseError(HttpServletResponse response, int httpCode, McpError mcpError)
      throws IOException {
    response.setContentType(APPLICATION_JSON);
    response.setCharacterEncoding(UTF_8);
    response.setStatus(httpCode);
    String jsonError = objectMapper.writeValueAsString(mcpError);
    PrintWriter writer = response.getWriter();
    writer.write(jsonError);
    writer.flush();
  }

  /**
   * Cleans up resources when the servlet is being destroyed.
   * <p>
   * This method ensures a graceful shutdown before calling the parent's destroy method.
   */
  @Override
  public void destroy() {
    closeGracefully().block();
    super.destroy();
  }

  /**
   * Create a builder for the server.
   * @return a fresh {@link Builder} instance.
   */
  public static Builder builder() {
    return new Builder();
  }

  /**
   * Builder for creating instances of {@link HttpServletStatelessServerTransport}.
   * <p>
   * This builder provides a fluent API for configuring and creating instances of
   * HttpServletStatelessServerTransport with custom settings.
   */
  public static class Builder {

    private ObjectMapper objectMapper;

    private String mcpEndpoint = "/mcp";

    private McpTransportContextExtractor<HttpServletRequest> contextExtractor =
        (serverRequest, context) -> context;

    private Builder() {
      // used by a static method
    }

    /**
     * Sets the ObjectMapper to use for JSON serialization/deserialization of MCP
     * messages.
     * @param objectMapper The ObjectMapper instance. Must not be null.
     * @return this builder instance
     * @throws IllegalArgumentException if objectMapper is null
     */
    public Builder objectMapper(ObjectMapper objectMapper) {
      Assert.notNull(objectMapper, "ObjectMapper must not be null");
      this.objectMapper = objectMapper;
      return this;
    }

    /**
     * Sets the endpoint URI where clients should send their JSON-RPC messages.
     * @param messageEndpoint The message endpoint URI. Must not be null.
     * @return this builder instance
     * @throws IllegalArgumentException if messageEndpoint is null
     */
    public Builder messageEndpoint(String messageEndpoint) {
      Assert.notNull(messageEndpoint, "Message endpoint must not be null");
      this.mcpEndpoint = messageEndpoint;
      return this;
    }

    /**
     * Sets the context extractor that allows providing the MCP feature
     * implementations to inspect HTTP transport level metadata that was present at
     * HTTP request processing time. This allows to extract custom headers and other
     * useful data for use during execution later on in the process.
     * @param contextExtractor The contextExtractor to fill in a
     * {@link McpTransportContext}.
     * @return this builder instance
     * @throws IllegalArgumentException if contextExtractor is null
     */
    public Builder contextExtractor(
        McpTransportContextExtractor<HttpServletRequest> contextExtractor) {
      Assert.notNull(contextExtractor, "Context extractor must not be null");
      this.contextExtractor = contextExtractor;
      return this;
    }

    /**
     * Builds a new instance of {@link HttpServletStatelessServerTransport} with the
     * configured settings.
     * @return A new HttpServletStatelessServerTransport instance
     * @throws IllegalStateException if required parameters are not set
     */
    public HttpServletStatelessServerTransport build() {
      Assert.notNull(objectMapper, "ObjectMapper must be set");
      Assert.notNull(mcpEndpoint, "Message endpoint must be set");

      return new HttpServletStatelessServerTransport(objectMapper, mcpEndpoint, contextExtractor);
    }
  }

  /**
   * Hook method for authentication. Subclasses can override this to provide
   * authentication.
   * @param request The HTTP servlet request
   * @param response The HTTP servlet response
   * @return true if authentication succeeded, false if it failed
   * @throws ServletException If a servlet-specific error occurs
   * @throws IOException If an I/O error occurs
   */
  protected boolean authenticateRequest(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    // Default implementation does no authentication
    return true;
  }
}
