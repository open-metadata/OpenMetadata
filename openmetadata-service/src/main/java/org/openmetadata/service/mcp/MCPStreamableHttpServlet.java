package org.openmetadata.service.mcp;

import static org.openmetadata.service.mcp.McpUtils.getJsonRpcMessageWithAuthorizationParam;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpServerSession;
import io.modelcontextprotocol.spec.McpServerTransportProvider;
import jakarta.servlet.AsyncContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mcp.tools.DefaultToolContext;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.util.JsonUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * MCP (Model Context Protocol) Streamable HTTP Servlet
 * This servlet implements the Streamable HTTP transport specification for MCP.
 */
@WebServlet(value = "/mcp", asyncSupported = true)
@Slf4j
public class MCPStreamableHttpServlet extends HttpServlet implements McpServerTransportProvider {

  private static final String SESSION_HEADER = "Mcp-Session-Id";
  private static final String CONTENT_TYPE_JSON = "application/json";
  private static final String CONTENT_TYPE_SSE = "text/event-stream";
  private ObjectMapper objectMapper = new ObjectMapper();
  private Map<String, MCPSession> sessions = new ConcurrentHashMap<>();
  private Map<String, SSEConnection> sseConnections = new ConcurrentHashMap<>();
  private SecureRandom secureRandom = new SecureRandom();
  private ExecutorService executorService =
      Executors.newCachedThreadPool(
          r -> {
            Thread t = new Thread(r, "MCP-Worker-Streamable");
            t.setDaemon(true);
            return t;
          });
  private McpServerSession.Factory sessionFactory;
  private final JwtFilter jwtFilter;
  private final Authorizer authorizer;
  private final List<McpSchema.Tool> tools = new ArrayList<>();
  private final Limits limits;
  private final DefaultToolContext toolContext;

  public MCPStreamableHttpServlet(
      JwtFilter jwtFilter,
      Authorizer authorizer,
      Limits limits,
      DefaultToolContext toolContext,
      List<McpSchema.Tool> tools) {
    this.jwtFilter = jwtFilter;
    this.authorizer = authorizer;
    this.limits = limits;
    this.toolContext = toolContext;
    this.tools.addAll(tools);
  }

  @Override
  public void init() throws ServletException {
    super.init();
    log("MCP Streamable HTTP Servlet initialized");
  }

  @Override
  public void destroy() {
    if (executorService != null) {
      executorService.shutdown();
      try {
        if (!executorService.awaitTermination(5, TimeUnit.SECONDS)) {
          executorService.shutdownNow();
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }

    // Close all SSE connections
    for (SSEConnection connection : sseConnections.values()) {
      try {
        connection.close();
      } catch (IOException e) {
        log("Error closing SSE connection", e);
      }
    }

    super.destroy();
  }

  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    // Security: Validate Origin header
    String origin = request.getHeader("Origin");
    if (origin != null && !isValidOrigin(origin)) {
      sendError(response, HttpServletResponse.SC_FORBIDDEN, "Invalid origin");
      return;
    }

    // Validate Accept header - MUST include both application/json and text/event-stream
    String acceptHeader = request.getHeader("Accept");
    if (acceptHeader == null
        || !acceptHeader.contains(CONTENT_TYPE_JSON)
        || !acceptHeader.contains(CONTENT_TYPE_SSE)) {
      sendError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          "Accept header must include both application/json and text/event-stream");
      return;
    }

    try {
      String requestBody = readRequestBody(request);
      String sessionId = request.getHeader(SESSION_HEADER);

      // Parse JSON-RPC message(s)
      McpSchema.JSONRPCMessage message =
          getJsonRpcMessageWithAuthorizationParam(this.objectMapper, request, requestBody);
      JsonNode jsonNode = objectMapper.valueToTree(message);

      // TODO: here we need to see how to handle the batch request from the Spec
      if (jsonNode.isArray()) {
        handleBatchRequest(request, response, jsonNode, sessionId);
      } else {
        handleSingleRequest(request, response, jsonNode, sessionId);
      }
    } catch (Exception e) {
      log("Error handling POST request", e);
      sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Internal server error");
    }
  }

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    String sessionId = request.getHeader(SESSION_HEADER);
    String acceptHeader = request.getHeader("Accept");

    if (acceptHeader == null || !acceptHeader.contains(CONTENT_TYPE_SSE)) {
      sendError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          "Accept header must include text/event-stream");
      return;
    }

    if (sessionId != null && !sessions.containsKey(sessionId)) {
      sendError(response, HttpServletResponse.SC_NOT_FOUND, "Session not found");
      return;
    }

    startSSEStreamForGet(request, response, sessionId);
  }

  @Override
  protected void doDelete(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    String sessionId = request.getHeader(SESSION_HEADER);

    if (sessionId == null) {
      sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Session ID required");
      return;
    }

    // Terminate session
    MCPSession session = sessions.remove(sessionId);
    if (session != null) {
      log("Session terminated: " + sessionId);
    }

    response.setStatus(HttpServletResponse.SC_OK);
  }

  private void handleSingleRequest(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode jsonRequest,
      String sessionId)
      throws IOException {

    String method = jsonRequest.has("method") ? jsonRequest.get("method").asText() : null;
    boolean hasId = jsonRequest.has("id");

    // Handle initialization
    if ("initialize".equals(method)) {
      handleInitialize(response, jsonRequest);
      return;
    }

    //  Validate session for non-initialization requests
    if (sessionId != null && !sessions.containsKey(sessionId)) {
      sendError(response, HttpServletResponse.SC_NOT_FOUND, "Session not found");
      return;
    }

    // Handle different message types
    if (!hasId) {
      // Notification - return 202 Accepted
      processNotification(jsonRequest, sessionId);
      response.setStatus(HttpServletResponse.SC_ACCEPTED);
    } else {
      // Request - may return JSON or start SSE stream
      String acceptHeader = request.getHeader("Accept");
      boolean supportsSSE = acceptHeader != null && acceptHeader.contains(CONTENT_TYPE_SSE);

      if (supportsSSE && shouldUseSSE()) {
        startSSEStream(request, response, jsonRequest, sessionId);
      } else {
        sendJSONResponse(response, jsonRequest, sessionId);
      }
    }
  }

  private void handleInitialize(HttpServletResponse response, JsonNode request) throws IOException {
    // Create new session
    String sessionId = generateSessionId();
    MCPSession session = new MCPSession(this.objectMapper, sessionId, response.getWriter());
    sessions.put(sessionId, session);

    // Create initialize response
    Map<String, Object> jsonResponse = new HashMap<>();
    jsonResponse.put("jsonrpc", "2.0");
    jsonResponse.put("id", request.get("id"));

    Map<String, Object> result = new HashMap<>();
    result.put("protocolVersion", "2024-11-05");
    result.put("capabilities", getServerCapabilities());
    result.put("serverInfo", getServerInfo());
    jsonResponse.put("result", result);

    // Send response with session ID
    String responseJson = objectMapper.writeValueAsString(jsonResponse);
    response.setContentType(CONTENT_TYPE_JSON);
    response.setHeader(SESSION_HEADER, sessionId);
    response.setStatus(HttpServletResponse.SC_OK);
    response.getWriter().write(responseJson);

    log("New session initialized: " + sessionId);
  }

  private void startSSEStream(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode jsonRequest,
      String sessionId)
      throws IOException {

    // Set up SSE response headers
    response.setContentType(CONTENT_TYPE_SSE);
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setStatus(HttpServletResponse.SC_OK);

    // Start async processing
    AsyncContext asyncContext = request.startAsync();
    asyncContext.setTimeout(0); // 5 minutes timeout

    SSEConnection connection = new SSEConnection(response.getWriter(), sessionId);
    String connectionId = UUID.randomUUID().toString();
    sseConnections.put(connectionId, connection);

    // Process request asynchronously
    executorService.submit(
        () -> {
          try {
            // Send any server-initiated messages first (if needed)
            //            sendServerInitiatedMessages(connection);

            // Process the actual request
            Map<String, Object> jsonResponse = processRequest(jsonRequest, sessionId);
            connection.sendEvent(objectMapper.writeValueAsString(jsonResponse));

            // Close the stream after sending response
            connection.close();
            asyncContext.complete();

          } catch (Exception e) {
            log("Error in SSE stream processing", e);
            try {
              connection.close();
              asyncContext.complete();
            } catch (Exception ex) {
              log("Error closing SSE connection", ex);
            }
          } finally {
            sseConnections.remove(connectionId);
          }
        });
  }

  private void startSSEStreamForGet(
      HttpServletRequest request, HttpServletResponse response, String sessionId)
      throws IOException {

    response.setContentType(CONTENT_TYPE_SSE);
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setStatus(HttpServletResponse.SC_OK);

    AsyncContext asyncContext = request.startAsync();
    asyncContext.setTimeout(0); // No timeout for long-lived connections

    SSEConnection connection = new SSEConnection(response.getWriter(), sessionId);
    String connectionId = UUID.randomUUID().toString();
    sseConnections.put(connectionId, connection);

    // Keep connection alive and handle server-initiated messages
    executorService.submit(
        () -> {
          try {
            while (!connection.isClosed()) {
              // Send keepalive every 30 seconds
              Thread.sleep(30000);
              connection.sendComment("keepalive");
            }
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          } catch (IOException e) {
            LOG.error("SSE connection error for connection ID:  {}", connectionId, e);
          } finally {
            try {
              connection.close();
              asyncContext.complete();
            } catch (Exception e) {
              log("Error closing long-lived SSE connection", e);
            }
            sseConnections.remove(connectionId);
          }
        });
  }

  @Override
  public void setSessionFactory(McpServerSession.Factory sessionFactory) {
    this.sessionFactory = sessionFactory;
  }

  @Override
  public Mono<Void> notifyClients(String method, Map<String, Object> params) {
    if (sessions.isEmpty()) {
      LOG.debug("No active sessions to broadcast message to");
      return Mono.empty();
    }

    LOG.debug("Attempting to broadcast message to {} active sessions", sessions.size());
    return Flux.fromIterable(sessions.values())
        .flatMap(
            session ->
                session
                    .sendNotification(method, params)
                    .doOnError(
                        e ->
                            LOG.error(
                                "Failed to send message to session {}: {}",
                                session.getSessionId(),
                                e.getMessage()))
                    .onErrorComplete())
        .then();
  }

  @Override
  public Mono<Void> closeGracefully() {
    LOG.debug("Initiating graceful shutdown with {} active sessions", sessions.size());
    return Flux.fromIterable(sessions.values()).flatMap(MCPSession::closeGracefully).then();
  }

  private static class SSEConnection {
    private final PrintWriter writer;
    private final String sessionId;
    private volatile boolean closed = false;
    private int eventId = 0;

    public SSEConnection(PrintWriter writer, String sessionId) {
      this.writer = writer;
      this.sessionId = sessionId;
    }

    public synchronized void sendEvent(String data) throws IOException {
      if (closed) return;

      writer.printf("id: %d%n", ++eventId);
      writer.printf("data: %s%n%n", data);
      writer.flush();

      if (writer.checkError()) {
        throw new IOException("SSE write error");
      }
    }

    private void sendEvent(String eventType, String data) throws IOException {
      writer.write("event: " + eventType + "\n");
      writer.write("data: " + data + "\n\n");
      writer.flush();
      if (writer.checkError()) {
        throw new IOException("Client disconnected");
      }
    }

    public synchronized void sendComment(String comment) throws IOException {
      if (closed) return;

      writer.printf(": %s%n%n", comment);
      writer.flush();

      if (writer.checkError()) {
        throw new IOException("SSE write error");
      }
    }

    public void close() throws IOException {
      closed = true;
      if (writer != null) {
        writer.close();
      }
    }

    public boolean isClosed() {
      return closed;
    }

    public String getSessionId() {
      return sessionId;
    }
  }

  private static class MCPSession {
    @Getter private final String sessionId;
    private final long createdAt;
    private final Map<String, Object> state;
    private final PrintWriter outputStream;
    private final ObjectMapper objectMapper;

    public MCPSession(ObjectMapper objectMapper, String sessionId, PrintWriter outputStream) {
      this.sessionId = sessionId;
      this.createdAt = System.currentTimeMillis();
      this.state = new ConcurrentHashMap<>();
      this.objectMapper = objectMapper;
      this.outputStream = outputStream;
    }

    public String getSessionId() {
      return sessionId;
    }

    public long getCreatedAt() {
      return createdAt;
    }

    public Map<String, Object> getState() {
      return state;
    }

    public Mono<Void> sendNotification(String method, Map<String, Object> params) {
      McpSchema.JSONRPCNotification jsonrpcNotification =
          new McpSchema.JSONRPCNotification(McpSchema.JSONRPC_VERSION, method, params);
      return Mono.fromRunnable(
          () -> {
            try {
              String json = objectMapper.writeValueAsString(jsonrpcNotification);
              outputStream.write(json);
              outputStream.write('\n');
              outputStream.flush();
            } catch (IOException e) {
              LOG.error("Failed to send message", e);
            }
          });
    }

    public Mono<Void> closeGracefully() {
      return Mono.fromRunnable(
          () -> {
            outputStream.flush();
            outputStream.close();
          });
    }
  }

  private Map<String, Object> processRequest(JsonNode request, String sessionId) {
    Map<String, Object> response = new HashMap<>();
    response.put("jsonrpc", "2.0");
    response.put("id", request.get("id"));

    String method = request.get("method").asText();

    try {
      switch (method) {
        case "ping":
          response.put("result", "pong");
          break;

        case "resources/list":
          // TODO: Implement resource reading logic
          response.put("result", getResourcesList());
          break;

        case "resources/read":
          // TODO: Implement resource reading logic
          break;

        case "tools/list":
          response.put("result", new McpSchema.ListToolsResult(tools, null));
          break;

        case "tools/call":
          JsonNode toolParams = request.get("params");
          if (toolParams != null && toolParams.has("name")) {
            String toolName = toolParams.get("name").asText();
            JsonNode arguments = toolParams.get("arguments");
            McpSchema.Content content =
                new McpSchema.TextContent(
                    JsonUtils.pojoToJson(
                        toolContext.callTool(
                            authorizer, jwtFilter, limits, toolName, JsonUtils.getMap(arguments))));
            response.put("result", new McpSchema.CallToolResult(List.of(content), false));
          } else {
            response.put("error", createError(-32602, "Invalid params"));
          }
          break;

        default:
          response.put("error", createError(-32601, "Method not found: " + method));
      }
    } catch (Exception e) {
      log("Error processing request: " + method, e);
      response.put("error", createError(-32603, "Internal error: " + e.getMessage()));
    }

    return response;
  }

  private void processNotification(JsonNode notification, String sessionId) {
    String method = notification.get("method").asText();
    log("Received notification: " + method + " (session: " + sessionId + ")");

    // Handle specific notifications
    switch (method) {
      case "notifications/initialized":
        LOG.info("Client initialized for session: {}", sessionId);
        break;
      case "notifications/cancelled":
        LOG.info("Client sent a cancellation request for session: {}", sessionId);
        // Handle cancellation
        break;
      default:
        log("Unknown notification: " + method);
    }
  }

  // Utility methods
  private String generateSessionId() {
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private boolean isValidOrigin(String origin) {
    // Implement your origin validation logic
    return origin.startsWith("http://localhost")
        || origin.startsWith("https://localhost")
        || origin.startsWith("https://yourdomain.com");
  }

  private boolean shouldUseSSE() {
    // TODO: Decide when to use SSE vs direct JSON response
    return false;
  }

  private String readRequestBody(HttpServletRequest request) throws IOException {
    StringBuilder body = new StringBuilder();
    try (BufferedReader reader = request.getReader()) {
      String line;
      while ((line = reader.readLine()) != null) {
        body.append(line);
      }
    }
    return body.toString();
  }

  private void sendError(HttpServletResponse response, int statusCode, String message)
      throws IOException {
    Map<String, Object> error = new HashMap<>();
    error.put("error", message);

    String errorJson = objectMapper.writeValueAsString(error);
    response.setContentType(CONTENT_TYPE_JSON);
    response.setStatus(statusCode);
    response.getWriter().write(errorJson);
  }

  private void sendJSONResponse(HttpServletResponse response, JsonNode request, String sessionId)
      throws IOException {
    Map<String, Object> jsonResponse = processRequest(request, sessionId);
    String responseJson = objectMapper.writeValueAsString(jsonResponse);

    response.setContentType(CONTENT_TYPE_JSON);
    response.setStatus(HttpServletResponse.SC_OK);
    response.getWriter().write(responseJson);
    response.getWriter().flush();
  }

  private void handleBatchRequest(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode batchRequest,
      String sessionId)
      throws IOException {
    // TODO: Handle this
    sendError(response, HttpServletResponse.SC_NOT_IMPLEMENTED, "Batch requests not implemented");
  }

  private Map<String, Object> createError(int code, String message) {
    Map<String, Object> error = new HashMap<>();
    error.put("code", code);
    error.put("message", message);
    return error;
  }

  private Map<String, Object> getServerCapabilities() {
    Map<String, Object> capabilities = new HashMap<>();

    // Resources capability
    Map<String, Object> resources = new HashMap<>();
    resources.put("subscribe", true);
    resources.put("listChanged", true);
    capabilities.put("resources", resources);

    // Tools
    Map<String, Object> tools = new HashMap<>();
    tools.put("listChanged", true);
    capabilities.put("tools", tools);

    return capabilities;
  }

  private Map<String, Object> getServerInfo() {
    Map<String, Object> serverInfo = new HashMap<>();
    serverInfo.put("name", "OpenMetadata MCP Server - Streamable");
    serverInfo.put("version", "1.0.0");
    return serverInfo;
  }

  private Map<String, Object> getResourcesList() {
    return new HashMap<>();
  }

  private Map<String, Object> createResource(
      String uri, String name, String mimeType, String description) {
    Map<String, Object> resource = new HashMap<>();
    resource.put("uri", uri);
    resource.put("name", name);
    resource.put("mimeType", mimeType);
    resource.put("description", description);
    return resource;
  }

  /**
   * Send a server-initiated notification to a specific session
   */
  public void sendNotificationToSession(
      String sessionId, String method, Map<String, Object> params) {
    // Find SSE connections for this session
    for (SSEConnection connection : sseConnections.values()) {
      if (sessionId.equals(connection.getSessionId())) {
        try {
          Map<String, Object> notification = new HashMap<>();
          notification.put("jsonrpc", "2.0");
          notification.put("method", method);
          if (params != null) {
            notification.put("params", params);
          }

          connection.sendEvent(objectMapper.writeValueAsString(notification));
        } catch (IOException e) {
          log("Error sending notification to session: " + sessionId, e);
        }
      }
    }
  }
}
