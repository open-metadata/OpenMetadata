/*
This class should be removed once we migrate to Jakarta.
*/

package org.openmetadata.service.mcp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpError;
import io.modelcontextprotocol.spec.McpSchema;
import io.modelcontextprotocol.spec.McpServerSession;
import io.modelcontextprotocol.spec.McpServerTransport;
import io.modelcontextprotocol.spec.McpServerTransportProvider;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.servlet.AsyncContext;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@WebServlet(asyncSupported = true)
public class HttpServletSseServerTransportProvider extends HttpServlet
    implements McpServerTransportProvider {
  private static final Logger logger =
      LoggerFactory.getLogger(HttpServletSseServerTransportProvider.class);
  public static final String UTF_8 = "UTF-8";
  public static final String APPLICATION_JSON = "application/json";
  public static final String FAILED_TO_SEND_ERROR_RESPONSE = "Failed to send error response: {}";
  public static final String DEFAULT_SSE_ENDPOINT = "/sse";
  public static final String MESSAGE_EVENT_TYPE = "message";
  public static final String ENDPOINT_EVENT_TYPE = "endpoint";
  private final ObjectMapper objectMapper;
  private final String messageEndpoint;
  private final String sseEndpoint;
  private final Map<String, McpServerSession> sessions;
  private final AtomicBoolean isClosing;
  private McpServerSession.Factory sessionFactory;

  public HttpServletSseServerTransportProvider(String messageEndpoint, String sseEndpoint) {
    this.sessions = new ConcurrentHashMap<>();
    this.isClosing = new AtomicBoolean(false);
    this.objectMapper = JsonUtils.getObjectMapper();
    this.messageEndpoint = messageEndpoint;
    this.sseEndpoint = sseEndpoint;
  }

  public HttpServletSseServerTransportProvider(String messageEndpoint) {
    this(messageEndpoint, "/sse");
  }

  public void setSessionFactory(McpServerSession.Factory sessionFactory) {
    this.sessionFactory = sessionFactory;
  }

  public Mono<Void> notifyClients(String method, Map<String, Object> params) {
    if (this.sessions.isEmpty()) {
      logger.debug("No active sessions to broadcast message to");
      return Mono.empty();
    } else {
      logger.debug("Attempting to broadcast message to {} active sessions", this.sessions.size());
      return Flux.fromIterable(this.sessions.values())
          .flatMap(
              (session) ->
                  session
                      .sendNotification(method, params)
                      .doOnError(
                          (e) ->
                              logger.error(
                                  "Failed to send message to session {}: {}",
                                  session.getId(),
                                  e.getMessage()))
                      .onErrorComplete())
          .then();
    }
  }

  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    handleSseEvent(request, response);
  }

  private void handleSseEvent(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    String pathInfo = request.getPathInfo();
    if (!this.sseEndpoint.contains(pathInfo)) {
      response.sendError(404);
    } else if (this.isClosing.get()) {
      response.sendError(503, "Server is shutting down");
    } else {
      response.setContentType("text/event-stream");
      response.setCharacterEncoding("UTF-8");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");
      response.setHeader("Access-Control-Allow-Origin", "*");
      String sessionId = UUID.randomUUID().toString();
      AsyncContext asyncContext = request.startAsync();
      asyncContext.setTimeout(0L);
      PrintWriter writer = response.getWriter();
      HttpServletMcpSessionTransport sessionTransport =
          new HttpServletMcpSessionTransport(sessionId, asyncContext, writer);
      McpServerSession session = this.sessionFactory.create(sessionTransport);
      this.sessions.put(sessionId, session);
      this.sendEvent(writer, "endpoint", this.messageEndpoint + "?sessionId=" + sessionId);
    }
  }

  protected void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    if (this.isClosing.get()) {
      response.sendError(503, "Server is shutting down");
    } else {
      String requestURI = request.getRequestURI();
      if (!requestURI.endsWith(this.messageEndpoint)) {
        response.sendError(404);
      } else {
        String sessionId = request.getParameter("sessionId");
        if (sessionId == null) {
          response.setContentType("application/json");
          response.setCharacterEncoding("UTF-8");
          response.setStatus(400);
          String jsonError =
              this.objectMapper.writeValueAsString(
                  new McpError("Session ID missing in message endpoint"));
          PrintWriter writer = response.getWriter();
          writer.write(jsonError);
          writer.flush();
        } else {
          McpServerSession session = (McpServerSession) this.sessions.get(sessionId);
          if (session == null) {
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setStatus(404);
            String jsonError =
                this.objectMapper.writeValueAsString(
                    new McpError("Session not found: " + sessionId));
            PrintWriter writer = response.getWriter();
            writer.write(jsonError);
            writer.flush();
          } else {
            try {
              BufferedReader reader = request.getReader();
              StringBuilder body = new StringBuilder();

              String line;
              while ((line = reader.readLine()) != null) {
                body.append(line);
              }

              McpSchema.JSONRPCMessage message =
                  getJsonRpcMessageWithAuthorizationParam(request, body.toString());
              session.handle(message).block();
              response.setStatus(200);
            } catch (Exception var11) {
              Exception e = var11;
              logger.error("Error processing message: {}", var11.getMessage());

              try {
                McpError mcpError = new McpError(e.getMessage());
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");
                response.setStatus(500);
                String jsonError = this.objectMapper.writeValueAsString(mcpError);
                PrintWriter writer = response.getWriter();
                writer.write(jsonError);
                writer.flush();
              } catch (IOException ex) {
                logger.error("Failed to send error response: {}", ex.getMessage());
                response.sendError(500, "Error processing message");
              }
            }
          }
        }
      }
    }
  }

  private McpSchema.JSONRPCMessage getJsonRpcMessageWithAuthorizationParam(
      HttpServletRequest request, String body) throws IOException {
    Map<String, Object> requestMessage = JsonUtils.getMap(JsonUtils.readTree(body));
    Map<String, Object> params = (Map<String, Object>) requestMessage.get("params");
    if (params != null) {
      Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");
      if (arguments != null) {
        arguments.put("Authorization", JwtFilter.extractToken(request.getHeader("Authorization")));
      }
    }
    return McpSchema.deserializeJsonRpcMessage(
        this.objectMapper, JsonUtils.pojoToJson(requestMessage));
  }

  public Mono<Void> closeGracefully() {
    this.isClosing.set(true);
    logger.debug("Initiating graceful shutdown with {} active sessions", this.sessions.size());
    return Flux.fromIterable(this.sessions.values())
        .flatMap(McpServerSession::closeGracefully)
        .then();
  }

  private void sendEvent(PrintWriter writer, String eventType, String data) throws IOException {
    writer.write("event: " + eventType + "\n");
    writer.write("data: " + data + "\n\n");
    writer.flush();
    if (writer.checkError()) {
      throw new IOException("Client disconnected");
    }
  }

  public void destroy() {
    this.closeGracefully().block();
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
      HttpServletSseServerTransportProvider.logger.debug(
          "Session transport {} initialized with SSE writer", sessionId);
    }

    public Mono<Void> sendMessage(McpSchema.JSONRPCMessage message) {
      return Mono.fromRunnable(
          () -> {
            try {
              String jsonText =
                  HttpServletSseServerTransportProvider.this.objectMapper.writeValueAsString(
                      message);
              HttpServletSseServerTransportProvider.this.sendEvent(
                  this.writer, "message", jsonText);
              HttpServletSseServerTransportProvider.logger.debug(
                  "Message sent to session {}", this.sessionId);
            } catch (Exception e) {
              HttpServletSseServerTransportProvider.logger.error(
                  "Failed to send message to session {}: {}", this.sessionId, e.getMessage());
              HttpServletSseServerTransportProvider.this.sessions.remove(this.sessionId);
              this.asyncContext.complete();
            }
          });
    }

    public <T> T unmarshalFrom(Object data, TypeReference<T> typeRef) {
      return (T)
          HttpServletSseServerTransportProvider.this.objectMapper.convertValue(data, typeRef);
    }

    public Mono<Void> closeGracefully() {
      return Mono.fromRunnable(
          () -> {
            HttpServletSseServerTransportProvider.logger.debug(
                "Closing session transport: {}", this.sessionId);

            try {
              HttpServletSseServerTransportProvider.this.sessions.remove(this.sessionId);
              this.asyncContext.complete();
              HttpServletSseServerTransportProvider.logger.debug(
                  "Successfully completed async context for session {}", this.sessionId);
            } catch (Exception e) {
              HttpServletSseServerTransportProvider.logger.warn(
                  "Failed to complete async context for session {}: {}",
                  this.sessionId,
                  e.getMessage());
            }
          });
    }

    public void close() {
      try {
        HttpServletSseServerTransportProvider.this.sessions.remove(this.sessionId);
        this.asyncContext.complete();
        HttpServletSseServerTransportProvider.logger.debug(
            "Successfully completed async context for session {}", this.sessionId);
      } catch (Exception e) {
        HttpServletSseServerTransportProvider.logger.warn(
            "Failed to complete async context for session {}: {}", this.sessionId, e.getMessage());
      }
    }
  }
}
