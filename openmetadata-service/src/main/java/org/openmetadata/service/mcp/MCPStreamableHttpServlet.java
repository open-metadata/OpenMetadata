package org.openmetadata.service.mcp;

import static org.openmetadata.service.mcp.McpUtils.getJsonRpcMessageWithAuthorizationParam;
import static org.openmetadata.service.mcp.McpUtils.readRequestBody;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpServerSession;
import io.modelcontextprotocol.spec.McpServerTransportProvider;
import jakarta.servlet.AsyncContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.Getter;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.MCPConfiguration;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mcp.prompts.DefaultPromptsContext;
import org.openmetadata.service.mcp.tools.DefaultToolContext;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
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

  private final transient ObjectMapper objectMapper = new ObjectMapper();
  private final transient Map<String, MCPSession> sessions = new ConcurrentHashMap<>();
  private final transient Map<String, SSEConnection> sseConnections = new ConcurrentHashMap<>();
  private final transient SecureRandom secureRandom = new SecureRandom();
  private final transient ExecutorService executorService =
      Executors.newCachedThreadPool(
          r -> {
            Thread t = new Thread(r, "MCP-Worker-Streamable");
            t.setDaemon(true);
            return t;
          });
  private transient McpServerSession.Factory sessionFactory;
  private final transient JwtFilter jwtFilter;
  private final transient Authorizer authorizer;
  private final transient List<McpSchema.Tool> tools = new ArrayList<>();
  private final transient List<McpSchema.Prompt> prompts = new ArrayList<>();
  private final transient Limits limits;
  private final transient DefaultToolContext toolContext;
  private final transient DefaultPromptsContext promptsContext;
  private static final LoadingCache<String, MCPConfiguration> MCP_CONFIG_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(100)
          .expireAfterWrite(1, TimeUnit.MINUTES)
          .build(new McpConfigLoader());

  public MCPStreamableHttpServlet(
      JwtFilter jwtFilter,
      Authorizer authorizer,
      Limits limits,
      DefaultToolContext toolContext,
      DefaultPromptsContext promptsContext,
      List<McpSchema.Tool> tools,
      List<McpSchema.Prompt> prompts) {
    this.jwtFilter = jwtFilter;
    this.authorizer = authorizer;
    this.limits = limits;
    this.toolContext = toolContext;
    this.promptsContext = promptsContext;
    this.tools.addAll(tools);
    this.prompts.addAll(prompts);
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
    String origin = request.getHeader("Origin");
    if (!isValidOrigin(origin)) {
      sendError(response, HttpServletResponse.SC_FORBIDDEN, "Invalid origin");
      return;
    }

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

      if (jsonNode.isArray()) {
        handleBatchRequest(request, response, jsonNode, sessionId);
      } else {
        handleSingleMessage(request, response, jsonNode, sessionId);
      }
    } catch (Exception e) {
      log("Error handling POST request", e);
      sendError(response, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Internal server error");
    }
  }

  /**
   * Handle a single JSON-RPC message according to MCP specification
   */
  private void handleSingleMessage(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode jsonMessage,
      String sessionId)
      throws IOException {

    String method = jsonMessage.has("method") ? jsonMessage.get("method").asText() : null;
    boolean hasId = jsonMessage.has("id");
    boolean isResponse = jsonMessage.has("result") || jsonMessage.has("error");

    // Handle initialization specially
    if ("initialize".equals(method)) {
      handleInitialize(response, jsonMessage);
      return;
    }

    // Validate session for non-initialization requests (except for responses/notifications)
    if (sessionId != null && !sessions.containsKey(sessionId) && !isResponse) {
      sendError(response, HttpServletResponse.SC_NOT_FOUND, "Session not found");
      return;
    }

    if (isResponse || (!hasId && method != null)) {
      // This is either a response or a notification
      handleResponseOrNotification(response, jsonMessage, sessionId, isResponse);
    } else if (hasId && method != null) {
      // This is a request - may return JSON or start SSE stream
      handleRequest(request, response, jsonMessage, sessionId);
    } else {
      sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Invalid JSON-RPC message format");
    }
  }

  /**
   * Handle responses and notifications from client
   */
  private void handleResponseOrNotification(
      HttpServletResponse response, JsonNode message, String sessionId, boolean isResponse)
      throws IOException {

    try {
      if (isResponse) {
        processClientResponse(message, sessionId);
        log("Processed client response for session: " + sessionId);
      } else {
        processNotification(message, sessionId);
        log("Processed client notification for session: " + sessionId);
      }

      response.setStatus(HttpServletResponse.SC_ACCEPTED);
      response.setContentLength(0);

    } catch (Exception e) {
      log("Error processing response/notification", e);
      sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Failed to process message");
    }
  }

  /**
   * Handle JSON-RPC requests from client
   */
  private void handleRequest(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode jsonRequest,
      String sessionId)
      throws IOException {

    String acceptHeader = request.getHeader("Accept");
    boolean supportsSSE = acceptHeader != null && acceptHeader.contains(CONTENT_TYPE_SSE);

    // Determine whether to use SSE stream or direct JSON response
    boolean useSSE = supportsSSE && shouldUseSSEForRequest(jsonRequest, sessionId);

    if (useSSE) {
      // Initiate SSE stream and process request asynchronously
      startSSEStreamForRequest(request, response, jsonRequest, sessionId);
    } else {
      // Send direct JSON response
      sendDirectJSONResponse(response, jsonRequest, sessionId);
    }
  }

  /**
   * Send direct JSON response for requests
   */
  private void sendDirectJSONResponse(
      HttpServletResponse response, JsonNode request, String sessionId) throws IOException {

    Map<String, Object> jsonResponse = processRequest(request, sessionId);
    String responseJson = objectMapper.writeValueAsString(jsonResponse);

    response.setContentType(CONTENT_TYPE_JSON);
    response.setStatus(HttpServletResponse.SC_OK);

    // Include session ID in response if present
    if (sessionId != null) {
      response.setHeader(SESSION_HEADER, sessionId);
    }

    response.getWriter().write(responseJson);
    response.getWriter().flush();
  }

  /**
   * Start SSE stream for processing requests
   */
  private void startSSEStreamForRequest(
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

    // Include session ID in response if present
    if (sessionId != null) {
      response.setHeader(SESSION_HEADER, sessionId);
    }

    response.setStatus(HttpServletResponse.SC_OK);

    // Start async processing
    AsyncContext asyncContext = request.startAsync();
    asyncContext.setTimeout(300000); // 5 minutes timeout

    SSEConnection connection = new SSEConnection(response.getWriter(), sessionId);
    String connectionId = UUID.randomUUID().toString();
    sseConnections.put(connectionId, connection);

    // Process request asynchronously
    executorService.submit(
        () -> {
          try {
            // Send server-initiated messages first
            // sendServerInitiatedMessages(connection);

            // Process the actual request and send response
            Map<String, Object> jsonResponse = processRequest(jsonRequest, sessionId);
            String eventId = generateEventId();
            connection.sendEventWithId(eventId, objectMapper.writeValueAsString(jsonResponse));

            // Close the stream after sending response
            connection.close();

          } catch (Exception e) {
            log("Error in SSE stream processing for request", e);
            try {
              // Send error response before closing
              Map<String, Object> errorResponse =
                  createErrorResponse(
                      jsonRequest.get("id"), -32603, "Internal error: " + e.getMessage());
              connection.sendEvent(objectMapper.writeValueAsString(errorResponse));
              connection.close();
            } catch (Exception ex) {
              log("Error sending error response in SSE stream", ex);
            }
          } finally {
            try {
              asyncContext.complete();
            } catch (Exception e) {
              log("Error completing async context", e);
            }
            sseConnections.remove(connectionId);
          }
        });
  }

  /**
   * Handle batch requests according to MCP specification
   */
  private void handleBatchRequest(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode batchRequest,
      String sessionId)
      throws IOException {

    if (!batchRequest.isArray() || batchRequest.size() == 0) {
      sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Invalid batch request format");
      return;
    }

    // Analyze the batch to determine message types
    boolean hasRequests = false;
    boolean hasResponsesOrNotifications = false;

    for (JsonNode message : batchRequest) {
      boolean hasId = message.has("id");
      boolean isResponse = message.has("result") || message.has("error");
      boolean hasMethod = message.has("method");

      if (hasId && hasMethod && !isResponse) {
        hasRequests = true;
      } else if (isResponse || (!hasId && hasMethod)) {
        hasResponsesOrNotifications = true;
      }
    }

    if (hasRequests && hasResponsesOrNotifications) {
      sendError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          "Batch cannot mix requests with responses/notifications");
      return;
    }

    if (hasResponsesOrNotifications) {
      // Process responses and notifications, return 202 Accepted
      processBatchResponsesOrNotifications(batchRequest, sessionId);
      response.setStatus(HttpServletResponse.SC_ACCEPTED);
      response.setContentLength(0);
    } else if (hasRequests) {
      // Process batch requests - determine if SSE or direct JSON
      String acceptHeader = request.getHeader("Accept");
      boolean supportsSSE = acceptHeader != null && acceptHeader.contains(CONTENT_TYPE_SSE);

      if (supportsSSE && shouldUseSSEForBatch(batchRequest, sessionId)) {
        startSSEStreamForBatchRequests(request, response, batchRequest, sessionId);
      } else {
        sendBatchJSONResponse(response, batchRequest, sessionId);
      }
    } else {
      sendError(response, HttpServletResponse.SC_BAD_REQUEST, "Invalid batch content");
    }
  }

  /**
   * Process client responses (for server-initiated requests)
   */
  private void processClientResponse(JsonNode response, String sessionId) {
    // Handle responses to server-initiated requests
    Object id = response.has("id") ? response.get("id") : null;
    LOG.info("Received client response for request ID: " + id + " (session: " + sessionId + ")");

    // TODO: Match with pending server requests and complete them
    // This would involve maintaining a map of pending requests by ID
  }

  /**
   * Determine if SSE should be used for a specific request
   */
  private boolean shouldUseSSEForRequest(JsonNode request, String sessionId) {
    // TODO: This is good for now, but we can enhance this logic later, like tools/call can be long
    // running for our use case should be fine
    // Use SSE for requests that are streaming operations or have specific methods
    MCPSession session = sessions.get(sessionId);
    return session != null;
  }

  /**
   * Determine if SSE should be used for batch requests
   */
  private boolean shouldUseSSEForBatch(JsonNode batchRequest, String sessionId) {
    // Use SSE for batches containing streaming operations
    for (JsonNode request : batchRequest) {
      if (shouldUseSSEForRequest(request, sessionId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Process batch responses and notifications
   */
  private void processBatchResponsesOrNotifications(JsonNode batch, String sessionId) {
    for (JsonNode message : batch) {
      boolean isResponse = message.has("result") || message.has("error");
      if (isResponse) {
        processClientResponse(message, sessionId);
      } else {
        processNotification(message, sessionId);
      }
    }
  }

  /**
   * Send batch JSON response
   */
  private void sendBatchJSONResponse(
      HttpServletResponse response, JsonNode batchRequest, String sessionId) throws IOException {

    List<Map<String, Object>> responses = new ArrayList<>();

    for (JsonNode request : batchRequest) {
      Map<String, Object> jsonResponse = processRequest(request, sessionId);
      responses.add(jsonResponse);
    }

    String responseJson = objectMapper.writeValueAsString(responses);

    response.setContentType(CONTENT_TYPE_JSON);
    response.setStatus(HttpServletResponse.SC_OK);

    if (sessionId != null) {
      response.setHeader(SESSION_HEADER, sessionId);
    }

    response.getWriter().write(responseJson);
    response.getWriter().flush();
  }

  /**
   * Start SSE stream for batch requests
   */
  private void startSSEStreamForBatchRequests(
      HttpServletRequest request,
      HttpServletResponse response,
      JsonNode batchRequest,
      String sessionId)
      throws IOException {

    // Set up SSE response headers
    response.setContentType(CONTENT_TYPE_SSE);
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("Access-Control-Allow-Origin", "*");

    if (sessionId != null) {
      response.setHeader(SESSION_HEADER, sessionId);
    }

    response.setStatus(HttpServletResponse.SC_OK);

    AsyncContext asyncContext = request.startAsync();
    asyncContext.setTimeout(300000); // 5 minutes timeout

    SSEConnection connection = new SSEConnection(response.getWriter(), sessionId);
    String connectionId = UUID.randomUUID().toString();
    sseConnections.put(connectionId, connection);

    // Process batch asynchronously
    executorService.submit(
        () -> {
          try {
            // Send server-initiated messages first
            // sendServerInitiatedMessages(connection);

            // Process each request in the batch
            List<Map<String, Object>> responses = new ArrayList<>();
            for (JsonNode req : batchRequest) {
              Map<String, Object> jsonResponse = processRequest(req, sessionId);
              responses.add(jsonResponse);
            }

            // Send batch response
            String eventId = generateEventId();
            connection.sendEventWithId(eventId, objectMapper.writeValueAsString(responses));

            connection.close();

          } catch (Exception e) {
            log("Error in SSE stream processing for batch", e);
            try {
              Map<String, Object> errorResponse =
                  createErrorResponse(null, -32603, "Internal error: " + e.getMessage());
              connection.sendEvent(objectMapper.writeValueAsString(errorResponse));
              connection.close();
            } catch (Exception ex) {
              log("Error sending error response in batch SSE stream", ex);
            }
          } finally {
            try {
              asyncContext.complete();
            } catch (Exception e) {
              log("Error completing async context for batch", e);
            }
            sseConnections.remove(connectionId);
          }
        });
  }

  /**
   * Create error response object
   */
  private Map<String, Object> createErrorResponse(JsonNode id, int code, String message) {
    Map<String, Object> response = new HashMap<>();
    response.put("jsonrpc", "2.0");
    response.put("id", id);
    response.put("error", createError(code, message));
    return response;
  }

  /**
   * Generate unique event ID for SSE
   */
  private String generateEventId() {
    return UUID.randomUUID().toString();
  }

  /**
   * Enhanced SSE connection class with event ID support
   */
  public static class SSEConnection {
    private final PrintWriter writer;
    private final String sessionId;
    private volatile boolean closed = false;
    private int eventCounter = 0;

    public SSEConnection(PrintWriter writer, String sessionId) {
      this.writer = writer;
      this.sessionId = sessionId;
    }

    public synchronized void sendEvent(String data) throws IOException {
      if (closed) return;

      writer.printf("id: %d%n", ++eventCounter);
      writer.printf("data: %s%n%n", data);
      writer.flush();

      if (writer.checkError()) {
        throw new IOException("SSE write error");
      }
    }

    public synchronized void sendEventWithId(String id, String data) throws IOException {
      if (closed) return;

      writer.printf("id: %s%n", id);
      writer.printf("data: %s%n%n", data);
      writer.flush();

      if (writer.checkError()) {
        throw new IOException("SSE write error");
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

  @Override
  protected void doDelete(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    String sessionId = request.getHeader(SESSION_HEADER);
    removeMCPSession(sessionId);
    response.setStatus(HttpServletResponse.SC_OK);
  }

  private void removeMCPSession(String sessionId) {
    if (sessionId == null) {
      throw BadRequestException.of("Session ID required");
    }

    // Terminate session
    MCPSession session = sessions.remove(sessionId);
    if (session != null) {
      LOG.info("Session terminated: " + sessionId);
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
        case McpSchema.METHOD_PING:
          response.put("result", "pong");
          break;

        case McpSchema.METHOD_RESOURCES_LIST:
          response.put("result", new McpSchema.ListResourcesResult(new ArrayList<>(), null));
          break;

        case McpSchema.METHOD_RESOURCES_READ:
          // TODO: Implement resource reading logic
          break;

        case McpSchema.METHOD_PROMPT_LIST:
          response.put("result", new McpSchema.ListPromptsResult(prompts, null));
          break;

        case McpSchema.METHOD_PROMPT_GET:
          Pair<String, Map<String, Object>> promptWithArgs = getArguments(request);
          if (promptWithArgs != null) {
            String promptName = promptWithArgs.getLeft();
            Map<String, Object> arguments = promptWithArgs.getRight();
            response.put(
                "result",
                promptsContext
                    .callPrompt(
                        jwtFilter, promptName, new McpSchema.GetPromptRequest(null, arguments))
                    .getResult());
          } else {
            response.put("error", createError(-32602, "Invalid params"));
          }
          break;

        case McpSchema.METHOD_TOOLS_LIST:
          response.put("result", new McpSchema.ListToolsResult(tools, null));
          break;

        case McpSchema.METHOD_TOOLS_CALL:
          Pair<String, Map<String, Object>> toolWithArgs = getArguments(request);
          if (toolWithArgs != null) {
            String toolName = toolWithArgs.getLeft();
            Map<String, Object> arguments = toolWithArgs.getRight();
            response.put(
                "result", toolContext.callTool(authorizer, jwtFilter, limits, toolName, arguments));
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

  private Pair<String, Map<String, Object>> getArguments(JsonNode request) {
    JsonNode toolParams = request.get("params");
    if (toolParams != null && toolParams.has("name")) {
      String toolName = toolParams.get("name").asText();
      JsonNode arguments = toolParams.get("arguments");
      return Pair.of(toolName, arguments != null ? JsonUtils.getMap(arguments) : new HashMap<>());
    }
    return null;
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
        // TODO: Check this
        LOG.info("Client sent a cancellation request for session: {}", sessionId);
        removeMCPSession(sessionId);
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
    try {
      if (MCP_CONFIG_CACHE.get("McpApplication").isOriginValidationEnabled()) {
        if (null == origin || origin.isEmpty()) {
          return false;
        } else {
          return origin.startsWith(MCP_CONFIG_CACHE.get("McpApplication").getOriginHeaderUri());
        }
      } else {
        return true;
      }
    } catch (ExecutionException e) {
      LOG.error("Error Validating Origin Header");
    }
    return false;
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

  private Map<String, Object> createError(int code, String message) {
    Map<String, Object> error = new HashMap<>();
    error.put("code", code);
    error.put("message", message);
    return error;
  }

  private McpSchema.ServerCapabilities getServerCapabilities() {
    return McpSchema.ServerCapabilities.builder()
        .tools(true)
        .prompts(true)
        .resources(true, true)
        .build();
  }

  private McpSchema.Implementation getServerInfo() {
    return new McpSchema.Implementation("OpenMetadata MCP Server - Streamable", "1.0.0");
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

  static class McpConfigLoader extends CacheLoader<String, MCPConfiguration> {
    @Override
    public @NonNull MCPConfiguration load(@CheckForNull String userName) {
      try {
        App app = Entity.getEntityByName(Entity.APPLICATION, "McpApplication", "id", Include.ALL);
        return JsonUtils.convertValue(app.getAppConfiguration(), MCPConfiguration.class);
      } catch (Exception ex) {
        LOG.error("Failed to Load MCP Configuration");
        MCPConfiguration config = new MCPConfiguration();
        config.setOriginHeaderUri(
            SettingsCache.getSetting(
                    SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION,
                    OpenMetadataBaseUrlConfiguration.class)
                .getOpenMetadataUrl());
        return config;
      }
    }
  }
}
