package org.openmetadata.mcp;

import static org.openmetadata.mcp.McpUtils.getJsonRpcMessageWithAuthorizationParam;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpServerSession;
import io.modelcontextprotocol.spec.McpServerTransport;
import io.modelcontextprotocol.spec.McpServerTransportProvider;
import io.modelcontextprotocol.util.Assert;
import jakarta.servlet.AsyncContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Slf4j
@WebServlet(asyncSupported = true)
public class HttpServletSseServerTransportProvider extends HttpServlet
    implements McpServerTransportProvider {
  public static final String UTF_8 = "UTF-8";
  public static final String APPLICATION_JSON = "application/json";
  public static final String FAILED_TO_SEND_ERROR_RESPONSE = "Failed to send error response: {}";
  public static final String DEFAULT_SSE_ENDPOINT = "/sse";
  public static final String MESSAGE_EVENT_TYPE = "message";
  public static final String ENDPOINT_EVENT_TYPE = "endpoint";
  public static final String DEFAULT_BASE_URL = "";
  private final ObjectMapper objectMapper;
  private final String baseUrl;
  private final String messageEndpoint;
  private final String sseEndpoint;
  private final Map<String, McpServerSession> sessions = new ConcurrentHashMap<>();
  private final AtomicBoolean isClosing = new AtomicBoolean(false);
  private McpServerSession.Factory sessionFactory;
  private ExecutorService executorService =
      Executors.newCachedThreadPool(
          r -> {
            Thread t = new Thread(r, "MCP-Worker-SSE");
            t.setDaemon(true);
            return t;
          });

  public HttpServletSseServerTransportProvider(
      ObjectMapper objectMapper, String messageEndpoint, String sseEndpoint) {
    this(objectMapper, DEFAULT_BASE_URL, messageEndpoint, sseEndpoint);
  }

  public HttpServletSseServerTransportProvider(
      ObjectMapper objectMapper, String baseUrl, String messageEndpoint, String sseEndpoint) {
    this.objectMapper = objectMapper;
    this.baseUrl = baseUrl;
    this.messageEndpoint = messageEndpoint;
    this.sseEndpoint = sseEndpoint;
  }

  public HttpServletSseServerTransportProvider(ObjectMapper objectMapper, String messageEndpoint) {
    this(objectMapper, messageEndpoint, DEFAULT_SSE_ENDPOINT);
  }

  @Override
  public void setSessionFactory(McpServerSession.Factory sessionFactory) {
    this.sessionFactory = sessionFactory;
  }

  @Override
  public Mono<Void> notifyClients(String method, Object params) {
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
                                session.getId(),
                                e.getMessage()))
                    .onErrorComplete())
        .then();
  }

  @Override
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    handleSseEvent(request, response);
  }

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
                                session.getId(),
                                e.getMessage()))
                    .onErrorComplete())
        .then();
  }

  private void handleSseEvent(HttpServletRequest request, HttpServletResponse response)
      throws IOException {
    String requestURI = request.getRequestURI();
    if (!requestURI.endsWith(sseEndpoint)) {
      response.sendError(HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    if (isClosing.get()) {
      response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Server is shutting down");
      return;
    }

    response.setContentType("text/event-stream");
    response.setCharacterEncoding(UTF_8);
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("Access-Control-Allow-Origin", "*");

    String sessionId = UUID.randomUUID().toString();
    AsyncContext asyncContext = request.startAsync();
    asyncContext.setTimeout(0);

    PrintWriter writer = response.getWriter();

    // Create a new session transport
    HttpServletMcpSessionTransport sessionTransport =
        new HttpServletMcpSessionTransport(sessionId, asyncContext, writer);

    // Create a new session using the session factory
    McpServerSession session = sessionFactory.create(sessionTransport);
    this.sessions.put(sessionId, session);

    executorService.submit(
        () -> {
          // Handle session lifecycle and keepalive
          try {
            while (sessions.containsKey(sessionId) && !isClosing.get()) {
              // Send keepalive every 30 seconds
              Thread.sleep(30000);
              if (!isClosing.get() && sessions.containsKey(sessionId)) {
                writer.write(": keep-alive\n\n");
                writer.flush();

                // Check if client is still connected
                if (writer.checkError()) {
                  LOG.debug("Client disconnected for session: {}", sessionId);
                  break;
                }
              }
            }
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOG.debug("Keepalive thread interrupted for session: {}", sessionId);
          } catch (Exception e) {
            LOG.error("SSE error for session: {}", sessionId, e);
          } finally {
            sessions.remove(sessionId);
            try {
              session.closeGracefully();
              asyncContext.complete();
            } catch (IllegalStateException e) {
              // AsyncContext already completed
              LOG.debug("AsyncContext already completed for session: {}", sessionId);
            } catch (Exception e) {
              LOG.error("Error closing long-lived SSE connection for session: {}", sessionId, e);
            }
          }
        });

    // Send initial endpoint event
    this.sendEvent(
        writer,
        ENDPOINT_EVENT_TYPE,
        this.baseUrl + this.messageEndpoint + "?sessionId=" + sessionId);
  }

  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    if (isClosing.get()) {
      response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE, "Server is shutting down");
      return;
    }

    String requestURI = request.getRequestURI();
    if (!requestURI.endsWith(messageEndpoint)) {
      response.sendError(HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    // Get the session ID from the request parameter
    String sessionId = request.getParameter("sessionId");
    if (sessionId == null) {
      response.setContentType(APPLICATION_JSON);
      response.setCharacterEncoding(UTF_8);
      response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
      String jsonError =
          objectMapper.writeValueAsString(new McpError("Session ID missing in message endpoint"));
      PrintWriter writer = response.getWriter();
      writer.write(jsonError);
      writer.flush();
      return;
    }

    // Get the session from the sessions map
    McpServerSession session = sessions.get(sessionId);
    if (session == null) {
      response.setContentType(APPLICATION_JSON);
      response.setCharacterEncoding(UTF_8);
      response.setStatus(HttpServletResponse.SC_NOT_FOUND);
      String jsonError =
          objectMapper.writeValueAsString(new McpError("Session not found: " + sessionId));
      PrintWriter writer = response.getWriter();
      writer.write(jsonError);
      writer.flush();
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
          getJsonRpcMessageWithAuthorizationParam(this.objectMapper, request, body.toString());

      // Process the message through the session's handle method
      session.handle(message).block(); // Block for Servlet compatibility

      response.setStatus(HttpServletResponse.SC_OK);
    } catch (Exception e) {
      LOG.error("Error processing message: {}", e.getMessage());
      try {
        McpError mcpError = new McpError(e.getMessage());
        response.setContentType(APPLICATION_JSON);
        response.setCharacterEncoding(UTF_8);
        response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        String jsonError = objectMapper.writeValueAsString(mcpError);
        PrintWriter writer = response.getWriter();
        writer.write(jsonError);
        writer.flush();
      } catch (IOException ex) {
        LOG.error(FAILED_TO_SEND_ERROR_RESPONSE, ex.getMessage());
        response.sendError(
            HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Error processing message");
      }
    }
  }

  @Override
  public Mono<Void> closeGracefully() {
    isClosing.set(true);
    LOG.debug("Initiating graceful shutdown with {} active sessions", sessions.size());

    return Flux.fromIterable(sessions.values()).flatMap(McpServerSession::closeGracefully).then();
  }

  private void sendEvent(PrintWriter writer, String eventType, String data) throws IOException {
    writer.write("event: " + eventType + "\n");
    writer.write("data: " + data + "\n\n");
    writer.flush();
    if (writer.checkError()) {
      throw new IOException("Client disconnected");
    }
  }

  @Override
  public void destroy() {
    isClosing.set(true);
    LOG.info("Shutting down HttpServletSseServerTransportProvider");
    if (executorService != null) {
      executorService.shutdownNow();
    }
    closeGracefully().block();
    if (executorService != null) {
      try {
        if (!executorService.awaitTermination(2, TimeUnit.SECONDS)) {
          LOG.warn("Executor service did not terminate within timeout");
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    super.destroy();
  }

  private class HttpServletMcpSessionTransport implements McpServerTransport {
    private final String sessionId;
    private final AsyncContext asyncContext;
    private final PrintWriter writer;

    HttpServletMcpSessionTransport(
        String sessionId, AsyncContext asyncContext, PrintWriter writer) {
      this.sessionId = sessionId;
      this.asyncContext = asyncContext;
      this.writer = writer;
      LOG.debug("Session transport {} initialized with SSE writer", sessionId);
    }

    @Override
    public Mono<Void> sendMessage(McpSchema.JSONRPCMessage message) {
      return Mono.fromRunnable(
          () -> {
            try {
              String jsonText = objectMapper.writeValueAsString(message);
              sendEvent(writer, MESSAGE_EVENT_TYPE, jsonText);
              LOG.debug("Message sent to session {}", sessionId);
            } catch (Exception e) {
              LOG.error("Failed to send message to session {}: {}", sessionId, e.getMessage());
              sessions.remove(sessionId);
              asyncContext.complete();
            }
          });
    }

    @Override
    public <T> T unmarshalFrom(Object data, TypeReference<T> typeRef) {
      return objectMapper.convertValue(data, typeRef);
    }

    @Override
    public Mono<Void> closeGracefully() {
      return Mono.fromRunnable(
          () -> {
            LOG.debug("Closing session transport: {}", sessionId);
            try {
              sessions.remove(sessionId);
              asyncContext.complete();
              LOG.debug("Successfully completed async context for session {}", sessionId);
            } catch (Exception e) {
              LOG.warn(
                  "Failed to complete async context for session {}: {}", sessionId, e.getMessage());
            }
          });
    }

    @Override
    public void close() {
      try {
        sessions.remove(sessionId);
        asyncContext.complete();
        LOG.debug("Successfully completed async context for session {}", sessionId);
      } catch (Exception e) {
        LOG.warn("Failed to complete async context for session {}: {}", sessionId, e.getMessage());
      }
    }
  }

  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {

    private ObjectMapper objectMapper = new ObjectMapper();

    private String baseUrl = DEFAULT_BASE_URL;

    private String messageEndpoint;

    private String sseEndpoint = DEFAULT_SSE_ENDPOINT;

    public Builder objectMapper(ObjectMapper objectMapper) {
      Assert.notNull(objectMapper, "ObjectMapper must not be null");
      this.objectMapper = objectMapper;
      return this;
    }

    public Builder baseUrl(String baseUrl) {
      Assert.notNull(baseUrl, "Base URL must not be null");
      this.baseUrl = baseUrl;
      return this;
    }

    public Builder messageEndpoint(String messageEndpoint) {
      Assert.hasText(messageEndpoint, "Message endpoint must not be empty");
      this.messageEndpoint = messageEndpoint;
      return this;
    }

    public Builder sseEndpoint(String sseEndpoint) {
      Assert.hasText(sseEndpoint, "SSE endpoint must not be empty");
      this.sseEndpoint = sseEndpoint;
      return this;
    }

    public HttpServletSseServerTransportProvider build() {
      if (objectMapper == null) {
        throw new IllegalStateException("ObjectMapper must be set");
      }
      if (messageEndpoint == null) {
        throw new IllegalStateException("MessageEndpoint must be set");
      }
      return new HttpServletSseServerTransportProvider(
          objectMapper, baseUrl, messageEndpoint, sseEndpoint);
    }
  }
}
