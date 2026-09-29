package org.openmetadata.service.socket;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.USER;

import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoNamespace;
import io.socket.socketio.server.SocketIoServer;
import io.socket.socketio.server.SocketIoSocket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;

@Slf4j
public class WebSocketManager {
  private static WebSocketManager instance;
  @Getter private final EngineIoServer engineIoServer;
  @Getter private final SocketIoServer socketIoServer;
  public static final String FEED_BROADCAST_CHANNEL = "activityFeed";
  public static final String TASK_BROADCAST_CHANNEL = "taskChannel";
  public static final String SEARCH_INDEX_JOB_BROADCAST_CHANNEL = "searchIndexJobStatus";
  public static final String DATA_INSIGHTS_JOB_BROADCAST_CHANNEL = "dataInsightsJobStatus";
  public static final String BACKGROUND_JOB_CHANNEL = "backgroundJobStatus";
  public static final String CACHE_WARMUP_JOB_BROADCAST_CHANNEL = "cacheWarmupJobStatus";
  public static final String MENTION_CHANNEL = "mentionChannel";
  public static final String ANNOUNCEMENT_CHANNEL = "announcementChannel";
  public static final String CSV_EXPORT_CHANNEL = "csvExportChannel";
  public static final String CSV_IMPORT_CHANNEL = "csvImportChannel";

  public static final String BULK_ASSETS_CHANNEL = "bulkAssetsChannel";

  public static final String DELETE_ENTITY_CHANNEL = "deleteEntityChannel";
  public static final String RESTORE_ENTITY_CHANNEL = "restoreEntityChannel";
  public static final String MOVE_GLOSSARY_TERM_CHANNEL = "moveGlossaryTermChannel";
  public static final String RDF_INDEX_JOB_BROADCAST_CHANNEL = "rdfIndexJobStatus";
  public static final String CHART_DATA_STREAM_CHANNEL = "chartDataStream";
  public static final String QUERY_RUNNER_CHANNEL = "queryRunnerChannel";

  @Getter
  private final Map<UUID, Map<String, SocketIoSocket>> activityFeedEndpoints =
      new ConcurrentHashMap<>();

  private static final long DEFAULT_SESSION_REVALIDATION_INTERVAL_MILLIS =
      TimeUnit.MINUTES.toMillis(1);
  private final Map<String, String> socketSessionIds = new ConcurrentHashMap<>();
  private final Map<String, Long> socketSessionValidatedAt = new ConcurrentHashMap<>();

  private WebSocketManager(EngineIoServerOptions eiOptions) {
    engineIoServer = new EngineIoServer(eiOptions);
    socketIoServer = new SocketIoServer(engineIoServer);
    initializeHandlers();
  }

  private void initializeHandlers() {
    SocketIoNamespace ns = socketIoServer.namespace("/");
    // On Connection
    ns.on(
        "connection",
        args -> {
          SocketIoSocket socket = (SocketIoSocket) args[0];
          List<String> remoteAddress = socket.getInitialHeaders().get("RemoteAddress");
          Map<String, List<String>> initialHeaders = socket.getInitialHeaders();
          List<String> userIdHeaders = listOrEmpty(initialHeaders.get("UserId"));
          List<String> sessionIdHeaders = listOrEmpty(initialHeaders.get("SessionId"));
          String userId =
              userIdHeaders.isEmpty()
                  ? socket.getInitialQuery().get("userId")
                  : userIdHeaders.get(0);
          String sessionId =
              sessionIdHeaders.isEmpty()
                  ? socket.getInitialQuery().get("sessionId")
                  : sessionIdHeaders.get(0);

          if (userId != null && !userId.isEmpty()) {
            LOG.info("Client : {} with Remote Address:{} connected", userId, remoteAddress);

            // On Socket Disconnect
            socket.on(
                "disconnect",
                args1 -> {
                  LOG.info(
                      "Client from: {} with Remote Address:{} disconnected.",
                      userId,
                      remoteAddress);
                  UUID id = UUID.fromString(userId);
                  activityFeedEndpoints.computeIfPresent(
                      id,
                      (key, connections) -> {
                        connections.remove(socket.getId());
                        socketSessionIds.remove(socket.getId());
                        socketSessionValidatedAt.remove(socket.getId());
                        return connections.isEmpty() ? null : connections;
                      });
                });

            // On Socket Connection Error
            socket.on(
                "connect_error",
                args1 ->
                    LOG.error(
                        "Connection ERROR for user:{} with Remote Address:{} disconnected",
                        userId,
                        remoteAddress));

            // On Socket Connection Failure
            socket.on(
                "connect_failed",
                args1 ->
                    LOG.error(
                        "Connection failed ERROR for user: {} with Remote Address: {} disconnected",
                        userId,
                        remoteAddress));

            UUID id = UUID.fromString(userId);
            Map<String, SocketIoSocket> userSocketConnections =
                activityFeedEndpoints.computeIfAbsent(id, k -> new ConcurrentHashMap<>());
            userSocketConnections.put(socket.getId(), socket);
            if (sessionId != null && !sessionId.isEmpty()) {
              socketSessionIds.put(socket.getId(), sessionId);
            }
          }
        });
    ns.on("error", args -> LOG.error("Connection error on the server"));
  }

  public static WebSocketManager getInstance() {
    return instance;
  }

  public void broadCastMessageToAll(String event, String message) {
    activityFeedEndpoints.forEach(
        (key, value) -> value.forEach((key1, value1) -> value1.send(event, message)));
  }

  public void sendToOne(UUID receiver, String event, String message) {
    if (activityFeedEndpoints.containsKey(receiver)) {
      activityFeedEndpoints.get(receiver).forEach((key, value) -> value.send(event, message));
    }
  }

  public void sendToOne(String username, String event, String message) {
    try {
      UUID receiver = Entity.getEntityReferenceByName(USER, username, Include.NON_DELETED).getId();
      if (activityFeedEndpoints.containsKey(receiver)) {
        activityFeedEndpoints.get(receiver).forEach((key, value) -> value.send(event, message));
      }
    } catch (EntityNotFoundException ex) {
      LOG.error("User with {} not found", username);
    }
  }

  public void sendToManyWithUUID(Set<UUID> receivers, String event, String message) {
    receivers.forEach(e -> sendToOne(e, event, message));
  }

  /**
   * Force-close every Socket.IO connection this pod is holding for the given user. Called locally
   * by {@code SessionService} when a session is revoked and via the cache-invalidation pub/sub
   * when revocation happens on another pod. Idempotent — a no-op if the user has no open sockets
   * on this pod.
   */
  public void disconnectAllForUser(UUID userId) {
    if (userId == null) {
      return;
    }
    Map<String, SocketIoSocket> sockets = activityFeedEndpoints.remove(userId);
    if (sockets == null || sockets.isEmpty()) {
      return;
    }
    LOG.info(
        "Force-disconnecting {} socket(s) for user {} on session revocation",
        sockets.size(),
        userId);
    for (SocketIoSocket socket : sockets.values()) {
      disconnectSocket(userId, socket);
    }
  }

  public void disconnectForSession(UUID userId, String sessionId) {
    if (userId == null || sessionId == null || sessionId.isEmpty()) {
      return;
    }
    Map<String, SocketIoSocket> sockets = activityFeedEndpoints.get(userId);
    if (sockets == null || sockets.isEmpty()) {
      return;
    }
    List<SocketIoSocket> matchingSockets = new ArrayList<>();
    sockets.forEach(
        (socketId, socket) -> {
          if (sessionId.equals(socketSessionIds.get(socketId))) {
            matchingSockets.add(socket);
          }
        });
    if (matchingSockets.isEmpty()) {
      return;
    }
    LOG.info(
        "Force-disconnecting {} socket(s) for user {} session {} on session revocation",
        matchingSockets.size(),
        userId,
        SessionService.truncateId(sessionId));
    matchingSockets.forEach(socket -> disconnectSocket(userId, socket));
    activityFeedEndpoints.computeIfPresent(
        userId, (key, connections) -> connections.isEmpty() ? null : connections);
  }

  public void disconnectInactiveSessions(SessionService sessionService) {
    disconnectInactiveSessions(sessionService, DEFAULT_SESSION_REVALIDATION_INTERVAL_MILLIS);
  }

  public void disconnectInactiveSessions(
      SessionService sessionService, long sessionRevalidationIntervalMillis) {
    if (sessionService == null || activityFeedEndpoints.isEmpty()) {
      return;
    }
    long now = System.currentTimeMillis();
    activityFeedEndpoints.forEach(
        (userId, sockets) -> {
          List<SocketIoSocket> socketsToDisconnect = new ArrayList<>();
          sockets.forEach(
              (socketId, socket) -> {
                String sessionId = socketSessionIds.get(socketId);
                if (sessionId != null
                    && isSessionRevalidationDue(socketId, now, sessionRevalidationIntervalMillis)) {
                  if (isSessionActiveForUser(sessionService, sessionId, userId)) {
                    socketSessionValidatedAt.put(socketId, now);
                  } else {
                    socketsToDisconnect.add(socket);
                  }
                }
              });
          socketsToDisconnect.forEach(socket -> disconnectSocket(userId, socket));
          activityFeedEndpoints.computeIfPresent(
              userId, (key, connections) -> connections.isEmpty() ? null : connections);
        });
  }

  private boolean isSessionRevalidationDue(
      String socketId, long now, long sessionRevalidationIntervalMillis) {
    if (sessionRevalidationIntervalMillis <= 0) {
      return true;
    }
    Long lastValidatedAt = socketSessionValidatedAt.get(socketId);
    if (lastValidatedAt != null && now - lastValidatedAt < sessionRevalidationIntervalMillis) {
      return false;
    }
    return true;
  }

  private boolean isSessionActiveForUser(
      SessionService sessionService, String sessionId, UUID expectedUserId) {
    return sessionService
        .getFreshSessionById(sessionId)
        .filter(
            session ->
                session.getStatus() == SessionStatus.ACTIVE
                    && !session.isExpired(System.currentTimeMillis())
                    && expectedUserId.toString().equals(session.getUserId()))
        .isPresent();
  }

  private void disconnectSocket(UUID userId, SocketIoSocket socket) {
    try {
      socketSessionIds.remove(socket.getId());
      socketSessionValidatedAt.remove(socket.getId());
      Map<String, SocketIoSocket> sockets = activityFeedEndpoints.get(userId);
      if (sockets != null) {
        sockets.remove(socket.getId());
      }
      socket.disconnect(true);
    } catch (Exception e) {
      LOG.warn("Failed to disconnect socket {} for user {}", socket.getId(), userId, e);
    }
  }

  public void sendToManyWithString(
      List<EntityRelationshipRecord> receivers, String event, String message) {
    receivers.forEach(e -> sendToOne(e.getId(), event, message));
  }

  public static class WebSocketManagerBuilder {
    private WebSocketManagerBuilder() {}

    public static void build(EngineIoServerOptions eiOptions) {
      instance = new WebSocketManager(eiOptions);
    }
  }
}
