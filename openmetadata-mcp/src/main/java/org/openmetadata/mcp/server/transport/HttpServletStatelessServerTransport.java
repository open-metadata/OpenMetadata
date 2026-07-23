/*
 * Copyright 2024-2024 the original author or authors.
 */

package org.openmetadata.mcp.server.transport;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.McpJsonDefaults;
import io.modelcontextprotocol.json.McpJsonMapper;
import io.modelcontextprotocol.server.McpStatelessServerHandler;
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
    implements McpStatelessServerTransport {

  private static final Logger logger =
      LoggerFactory.getLogger(HttpServletStatelessServerTransport.class);

  public static final String UTF_8 = "UTF-8";

  public static final String APPLICATION_JSON = "application/json";

  public static final String TEXT_EVENT_STREAM = "text/event-stream";

  public static final String ACCEPT = "Accept";

  public static final String FAILED_TO_SEND_ERROR_RESPONSE = "Failed to send error response: {}";

  static final String HEADER_CACHE_CONTROL = "Cache-Control";

  static final String HEADER_CONNECTION = "Connection";

  static final String HEADER_X_ACCEL_BUFFERING = "X-Accel-Buffering";

  static final String CACHE_CONTROL_NO_CACHE = "no-cache";

  static final String CONNECTION_KEEP_ALIVE = "keep-alive";

  static final String X_ACCEL_BUFFERING_NO = "no";

  static final String SSE_DATA_PREFIX = "data: ";

  static final String SSE_LINE_TERMINATOR = "\n";

  static final String SSE_EVENT_TERMINATOR = "\n\n";

  private final ObjectMapper objectMapper;

  private final McpJsonMapper jsonMapper;

  private final String mcpEndpoint;

  private McpStatelessServerHandler mcpHandler;

  private McpTransportContextExtractor<HttpServletRequest> contextExtractor;

  private volatile boolean isClosing = false;

  HttpServletStatelessServerTransport(
      ObjectMapper objectMapper,
      String mcpEndpoint,
      McpTransportContextExtractor<HttpServletRequest> contextExtractor) {
    Assert.notNull(objectMapper, "objectMapper must not be null");
    Assert.notNull(mcpEndpoint, "mcpEndpoint must not be null");
    Assert.notNull(contextExtractor, "contextExtractor must not be null");

    this.objectMapper = objectMapper;
    this.jsonMapper = McpJsonDefaults.getMapper();
    this.mcpEndpoint = mcpEndpoint;
    this.contextExtractor = contextExtractor;
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
    String requestURI = request.getRequestURI();
    if (!requestURI.equals(mcpEndpoint)) {
      response.sendError(HttpServletResponse.SC_NOT_FOUND);
      return;
    }
    response.sendError(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
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
    if (!requestURI.equals(mcpEndpoint)) {
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

    McpTransportContext transportContext = this.contextExtractor.extract(request);

    String accept = request.getHeader(ACCEPT);
    boolean acceptsJson = accept != null && accept.contains(APPLICATION_JSON);
    boolean acceptsSse = accept != null && accept.contains(TEXT_EVENT_STREAM);
    if (!acceptsJson && !acceptsSse) {
      this.responseError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          McpError.builder(McpSchema.ErrorCodes.INVALID_REQUEST)
              .message("Accept header must include application/json or text/event-stream")
              .build());
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
          McpSchema.deserializeJsonRpcMessage(jsonMapper, body.toString());

      if (message instanceof McpSchema.JSONRPCRequest jsonrpcRequest) {
        try {
          McpSchema.JSONRPCResponse jsonrpcResponse =
              this.mcpHandler
                  .handleRequest(transportContext, jsonrpcRequest)
                  .contextWrite(ctx -> ctx.put(McpTransportContext.KEY, transportContext))
                  .block();

          String jsonResponseText = jsonMapper.writeValueAsString(jsonrpcResponse);
          if (shouldEmitSse(acceptsJson, acceptsSse)) {
            writeSseResponse(response, jsonResponseText);
          } else {
            writeJsonResponse(response, jsonResponseText);
          }
        } catch (Exception e) {
          logger.error("Failed to handle request: {}", e.getMessage());
          this.responseError(
              response,
              HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
              McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
                  .message("Failed to handle request: " + e.getMessage())
                  .build());
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
              McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
                  .message("Failed to handle notification: " + e.getMessage())
                  .build());
        }
      } else {
        this.responseError(
            response,
            HttpServletResponse.SC_BAD_REQUEST,
            McpError.builder(McpSchema.ErrorCodes.INVALID_REQUEST)
                .message("The server accepts either requests or notifications")
                .build());
      }
    } catch (IllegalArgumentException | IOException e) {
      logger.error("Failed to deserialize message: {}", e.getMessage());
      this.responseError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          McpError.builder(McpSchema.ErrorCodes.INVALID_REQUEST)
              .message("Invalid message format")
              .build());
    } catch (Exception e) {
      logger.error("Unexpected error handling message: {}", e.getMessage());
      this.responseError(
          response,
          HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
          McpError.builder(McpSchema.ErrorCodes.INTERNAL_ERROR)
              .message("Unexpected error: " + e.getMessage())
              .build());
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
    String jsonError = jsonMapper.writeValueAsString(mcpError);
    PrintWriter writer = response.getWriter();
    writer.write(jsonError);
    writer.flush();
  }

  /**
   * Picks the response media type via Accept-header content negotiation. JSON is preferred whenever
   * the client accepts it, because the MCP Streamable HTTP spec has clients send {@code Accept:
   * application/json, text/event-stream} and most (e.g. the ai-sdk Python client) cannot parse an
   * SSE {@code data: } framed body. SSE is emitted only for clients that accept event-stream but
   * NOT JSON (e.g. the Databricks Supervisor Agent client).
   */
  static boolean shouldEmitSse(boolean acceptsJson, boolean acceptsSse) {
    return acceptsSse && !acceptsJson;
  }

  static void writeJsonResponse(HttpServletResponse response, String jsonResponseText)
      throws IOException {
    response.setContentType(APPLICATION_JSON);
    response.setCharacterEncoding(UTF_8);
    response.setStatus(HttpServletResponse.SC_OK);
    PrintWriter writer = response.getWriter();
    writer.write(jsonResponseText);
    writer.flush();
  }

  /**
   * Writes a JSON-RPC response as a one-shot Server-Sent Events stream. Required for MCP
   * Streamable HTTP clients (e.g. Databricks Supervisor Agent's "databricks" v1.0.0 client) that
   * negotiate {@code text/event-stream} via the {@code Accept} header and refuse to parse plain
   * {@code application/json} responses.
   *
   * <p>Per the W3C SSE spec, payloads containing line breaks must prefix every line with
   * {@code data: }. The default {@code McpJsonMapper} produces compact JSON, but this method
   * splits defensively so that any embedded newline (e.g., a literal {@code \n} inside an error
   * message) cannot truncate the event for the client.
   */
  static void writeSseResponse(HttpServletResponse response, String jsonResponseText)
      throws IOException {
    response.setContentType(TEXT_EVENT_STREAM);
    response.setCharacterEncoding(UTF_8);
    response.setHeader(HEADER_CACHE_CONTROL, CACHE_CONTROL_NO_CACHE);
    response.setHeader(HEADER_CONNECTION, CONNECTION_KEEP_ALIVE);
    response.setHeader(HEADER_X_ACCEL_BUFFERING, X_ACCEL_BUFFERING_NO);
    response.setStatus(HttpServletResponse.SC_OK);
    PrintWriter writer = response.getWriter();
    for (String line : jsonResponseText.split("\\R", -1)) {
      writer.write(SSE_DATA_PREFIX);
      writer.write(line);
      writer.write(SSE_LINE_TERMINATOR);
    }
    writer.write(SSE_LINE_TERMINATOR);
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
        serverRequest -> McpTransportContext.EMPTY;

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
