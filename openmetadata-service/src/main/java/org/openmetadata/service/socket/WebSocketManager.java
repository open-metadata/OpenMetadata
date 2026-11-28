package org.openmetadata.service.socket;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.socket.HandshakeIdentity.PROVIDER_HEADER;
import static org.openmetadata.service.socket.HandshakeIdentity.SESSION_ID_HEADER;
import static org.openmetadata.service.socket.HandshakeIdentity.TOKEN_EXPIRES_AT_HEADER;
import static org.openmetadata.service.socket.HandshakeIdentity.USER_ID_HEADER;

import com.google.common.annotations.VisibleForTesting;
import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoNamespace;
import io.socket.socketio.server.SocketIoServer;
import io.socket.socketio.server.SocketIoSocket;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.function.Supplier;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.security.session.SessionProviders;
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

  /**
   * Sent to a socket opened without a session right before the sweep closes it because its token
   * expired. The UI reconnects with its renewed token only after this notice; every other server
   * close is final.
   * ADR:2026-11-26-a-push-feed-socket-without-a-session-ends-when-its-token-expires-or-its-user-is-deleted
   */
  public static final String TOKEN_EXPIRED_CHANNEL = "tokenExpiredChannel";

  @Getter
  private final Map<UUID, Map<String, SocketIoSocket>> activityFeedEndpoints =
      new ConcurrentHashMap<>();

  private static final long DEFAULT_SESSION_REVALIDATION_INTERVAL_MILLIS =
      TimeUnit.MINUTES.toMillis(1);
  private final Map<String, String> socketSessionIds = new ConcurrentHashMap<>();
  private final Map<String, Long> socketSessionValidatedAt = new ConcurrentHashMap<>();
  private final SocketTokenExpiries socketTokenExpiries = new SocketTokenExpiries();

  // Cross-pod delivery for sendToOne; a Redis or DB relay is injected at startup (no-op by
  // default).
  private volatile WebSocketRelay relay = new NoopWebSocketRelay();

  /**
   * The provider the handshake filter validates under: what a socket's provider is judged against.
   * A reload publishes its configuration before it initializes the new authenticator and rolls back
   * if that fails, so this follows the filter, which only a reload that succeeded replaces.
   */
  private final Supplier<AuthProvider> appliedProvider;

  private final Clock clock;
  private final Predicate<UUID> isUserGone;
  private final Consumer<UUID> notifyPeersAccessEnded;

  private WebSocketManager(EngineIoServerOptions eiOptions, PushFeedSocketPolicy policy) {
    engineIoServer = new EngineIoServer(eiOptions);
    socketIoServer = new SocketIoServer(engineIoServer);
    this.appliedProvider = policy.appliedProvider();
    this.clock = policy.clock();
    this.isUserGone = policy.isUserGone();
    this.notifyPeersAccessEnded = policy.notifyPeersAccessEnded();
    initializeHandlers();
  }

  private void initializeHandlers() {
    SocketIoNamespace ns = socketIoServer.namespace("/");
    // On Connection
    ns.on("connection", args -> onConnection((SocketIoSocket) args[0]));
    ns.on("error", args -> LOG.error("Connection error on the server"));
  }

  @VisibleForTesting
  void onConnection(SocketIoSocket socket) {
    Map<String, List<String>> initialHeaders = socket.getInitialHeaders();
    List<String> remoteAddress = initialHeaders.get("RemoteAddress");
    // The socket identity, session and provider come exclusively from the headers stamped by
    // SocketAddressFilter after validating the handshake credential. The raw query params are
    // client-controlled and must never key a socket.
    String userId = firstHeader(initialHeaders, USER_ID_HEADER);
    if (userId != null && !userId.isEmpty()) {
      LOG.info("Client : {} with Remote Address:{} connected", userId, remoteAddress);
      UUID id = UUID.fromString(userId);
      listenForClose(socket, id, remoteAddress);
      register(socket, id, initialHeaders);
      disconnectIfValidatedUnderAnotherProvider(
          id, socket, firstHeader(initialHeaders, PROVIDER_HEADER));
    }
  }

  private void listenForClose(SocketIoSocket socket, UUID userId, List<String> remoteAddress) {
    socket.on(
        "disconnect",
        args -> {
          LOG.info("Client from: {} with Remote Address:{} disconnected.", userId, remoteAddress);
          forgetSocket(socket.getId());
          activityFeedEndpoints.computeIfPresent(
              userId,
              (key, connections) -> {
                connections.remove(socket.getId());
                return connections.isEmpty() ? null : connections;
              });
        });
    socket.on(
        "connect_error",
        args ->
            LOG.error(
                "Connection ERROR for user:{} with Remote Address:{} disconnected",
                userId,
                remoteAddress));
    socket.on(
        "connect_failed",
        args ->
            LOG.error(
                "Connection failed ERROR for user: {} with Remote Address: {} disconnected",
                userId,
                remoteAddress));
  }

  /** The per-socket entries come first, so a sweep never sees a socket without them. */
  private void register(
      SocketIoSocket socket, UUID userId, Map<String, List<String>> initialHeaders) {
    String socketId = socket.getId();
    String sessionId = firstHeader(initialHeaders, SESSION_ID_HEADER);
    if (sessionId != null && !sessionId.isEmpty()) {
      socketSessionIds.put(socketId, sessionId);
    }
    String tokenExpiresAt = firstHeader(initialHeaders, TOKEN_EXPIRES_AT_HEADER);
    if (tokenExpiresAt != null) {
      socketTokenExpiries.record(socketId, tokenExpiresAt);
    }
    activityFeedEndpoints
        .computeIfAbsent(userId, k -> new ConcurrentHashMap<>())
        .put(socketId, socket);
  }

  private static String firstHeader(Map<String, List<String>> headers, String name) {
    List<String> values = listOrEmpty(headers.get(name));
    return values.isEmpty() ? null : values.getFirst();
  }

  /**
   * The handshake is validated on the upgrade, but the socket registers here one round trip later,
   * when the client's CONNECT arrives. A provider switch landing between the two would miss it: the
   * reload closes only registered sockets, and the sweep skips a socket without a session. The
   * socket is registered before this check, and the reload rebuilds the handshake filter before it
   * closes sockets, so whichever runs second catches it.
   * ADR:2026-10-20-a-refresh-ends-sessions-issued-by-a-provider-no-longer-configured
   */
  private void disconnectIfValidatedUnderAnotherProvider(
      UUID userId, SocketIoSocket socket, String validatedProvider) {
    AuthProvider applied = appliedProvider.get();
    if (!SessionProviders.isFromAnotherProvider(validatedProvider, applied)) {
      return;
    }
    LOG.info(
        "Closing socket for user {}: its handshake was validated under provider {}, but the push"
            + " feed validates under {} now",
        userId,
        validatedProvider,
        applied.value());
    disconnectSocket(userId, socket);
    activityFeedEndpoints.computeIfPresent(
        userId, (key, connections) -> connections.isEmpty() ? null : connections);
  }

  public static WebSocketManager getInstance() {
    return instance;
  }

  // Node-local; cross-pod broadcast is not wired through the relay (the relay supports SCOPE_ALL).
  public void broadCastMessageToAll(String event, String message) {
    broadCastMessageToAllLocal(event, message);
  }

  public void sendToOne(UUID receiver, String event, String message) {
    // Deliver locally, then relay to peers so the pod holding the socket is reached (no-op
    // single-pod).
    sendToOneLocal(receiver, event, message);
    relay.publishToUser(receiver, event, message);
  }

  public void sendToOne(String username, String event, String message) {
    try {
      UUID receiver = Entity.getEntityReferenceByName(USER, username, Include.NON_DELETED).getId();
      sendToOne(receiver, event, message);
    } catch (EntityNotFoundException ex) {
      LOG.error("User with {} not found", username);
    }
  }

  /** Deliver to this user's sockets on this pod only (no relay) — used by the relay on receive. */
  public void sendToOneLocal(UUID receiver, String event, String message) {
    Map<String, SocketIoSocket> connections = activityFeedEndpoints.get(receiver);
    if (connections != null) {
      connections.forEach((key, value) -> value.send(event, message));
    }
  }

  /** Broadcast to this pod's sockets only (no relay) — the receive side of a SCOPE_ALL frame. */
  public void broadCastMessageToAllLocal(String event, String message) {
    activityFeedEndpoints.forEach(
        (key, value) -> value.forEach((key1, value1) -> value1.send(event, message)));
  }

  /** Deliver a relayed frame to this pod's sockets by scope (local only — never re-published). */
  public void deliverRelayedFrame(String scope, String target, String event, String message) {
    if (WebSocketRelay.SCOPE_ALL.equals(scope)) {
      broadCastMessageToAllLocal(event, message);
      return;
    }
    if (WebSocketRelay.SCOPE_USER.equals(scope) && target != null) {
      try {
        sendToOneLocal(UUID.fromString(target), event, message);
      } catch (IllegalArgumentException ex) {
        LOG.debug("Relayed frame with non-UUID target {} ignored", target);
      }
    }
  }

  public void setRelay(WebSocketRelay relay) {
    this.relay = relay == null ? new NoopWebSocketRelay() : relay;
  }

  public WebSocketRelay getRelay() {
    return relay;
  }

  public void sendToManyWithUUID(Set<UUID> receivers, String event, String message) {
    receivers.forEach(e -> sendToOne(e, event, message));
  }

  /**
   * Force-close every Socket.IO connection this pod is holding for the given user. Called when a
   * provider switch closes every socket, when the user is deleted (here through {@link
   * #endAccessForUser}, on peers through the cache-invalidation pub/sub), and by the sweep for a
   * user who is gone. Idempotent: a no-op if the user has no open sockets on this pod.
   */
  public void disconnectAllForUser(UUID userId) {
    Map<String, SocketIoSocket> sockets =
        userId == null ? null : activityFeedEndpoints.remove(userId);
    if (!nullOrEmpty(sockets)) {
      LOG.info("Force-disconnecting {} socket(s) for user {}", sockets.size(), userId);
      sockets.values().forEach(socket -> disconnectSocket(userId, socket));
    }
  }

  /**
   * Ends a deleted user's push feed: closes their sockets on this server and tells the other
   * servers to close theirs. The session revocation a delete performs cannot reach a socket opened
   * with a token that carries no session.
   * ADR:2026-11-26-a-push-feed-socket-without-a-session-ends-when-its-token-expires-or-its-user-is-deleted
   */
  public void endAccessForUser(UUID userId) {
    if (userId != null) {
      disconnectAllForUser(userId);
      notifyPeersAccessEnded.accept(userId);
    }
  }

  /**
   * Closes every socket this server holds, with or without a session: a socket opened with a
   * provider token has no session the sweep could re-check against the new provider.
   */
  public void disconnectAll() {
    activityFeedEndpoints.keySet().forEach(this::disconnectAllForUser);
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

  /**
   * One sweep pass over this server's sockets. A socket opened without a session closes, after the
   * token expired notice, once its token's exp is before now; every socket of a user who is gone
   * closes; a socket with a session closes once its session is no longer active, checked at most
   * once per interval.
   */
  public void disconnectInactiveSessions(
      SessionService sessionService, long sessionRevalidationIntervalMillis) {
    SweepPass pass =
        new SweepPass(
            sessionService,
            clock.instant(),
            sessionRevalidationIntervalMillis,
            appliedProvider.get());
    activityFeedEndpoints.forEach((userId, sockets) -> sweepUser(pass, userId, sockets));
  }

  /** Only users holding a socket without a session are looked up: sessions end with a delete. */
  private void sweepUser(SweepPass pass, UUID userId, Map<String, SocketIoSocket> sockets) {
    if (hasSocketWithoutSession(sockets) && isUserGone.test(userId)) {
      LOG.info("Closing every push-feed socket of user {}: the user no longer exists", userId);
      disconnectAllForUser(userId);
    } else {
      socketsMatching(sockets, socketId -> socketTokenExpiries.hasExpired(socketId, pass.now()))
          .forEach(socket -> closeForExpiredToken(userId, socket));
      closeSocketsWhoseSessionEnded(pass, userId, sockets);
      activityFeedEndpoints.computeIfPresent(
          userId, (key, connections) -> connections.isEmpty() ? null : connections);
    }
  }

  private boolean hasSocketWithoutSession(Map<String, SocketIoSocket> sockets) {
    return sockets.keySet().stream().anyMatch(socketId -> !socketSessionIds.containsKey(socketId));
  }

  /** The notice goes out first; both ride the socket's ordered write buffer. */
  private void closeForExpiredToken(UUID userId, SocketIoSocket socket) {
    LOG.info(
        "Closing push-feed socket {} of user {}: the token it was opened with has expired",
        socket.getId(),
        userId);
    try {
      socket.send(TOKEN_EXPIRED_CHANNEL);
    } catch (RuntimeException sendFailure) {
      LOG.debug(
          "Could not send the token expired notice to socket {}", socket.getId(), sendFailure);
    }
    disconnectSocket(userId, socket);
  }

  private void closeSocketsWhoseSessionEnded(
      SweepPass pass, UUID userId, Map<String, SocketIoSocket> sockets) {
    if (pass.sessionService() != null) {
      socketsMatching(sockets, socketId -> failsSessionRevalidation(pass, userId, socketId))
          .forEach(socket -> disconnectSocket(userId, socket));
    }
  }

  /** True when the socket's session was due for a recheck and failed it; a pass is recorded. */
  private boolean failsSessionRevalidation(SweepPass pass, UUID userId, String socketId) {
    String sessionId = socketSessionIds.get(socketId);
    long now = pass.now().toEpochMilli();
    boolean failed = false;
    if (sessionId != null && isSessionRevalidationDue(socketId, now, pass.intervalMillis())) {
      failed = !isSessionActiveForUser(pass.sessionService(), sessionId, userId, pass.applied());
      if (!failed) {
        socketSessionValidatedAt.put(socketId, now);
      }
    }
    return failed;
  }

  private static List<SocketIoSocket> socketsMatching(
      Map<String, SocketIoSocket> sockets, Predicate<String> socketIdMatches) {
    return sockets.entrySet().stream()
        .filter(entry -> socketIdMatches.test(entry.getKey()))
        .map(Map.Entry::getValue)
        .toList();
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
      SessionService sessionService, String sessionId, UUID expectedUserId, AuthProvider applied) {
    return sessionService
        .getFreshSessionById(sessionId)
        .filter(
            session ->
                session.getStatus() == SessionStatus.ACTIVE
                    && !session.isExpired(System.currentTimeMillis())
                    && expectedUserId.toString().equals(session.getUserId())
                    && !SessionProviders.isFromAnotherProvider(session.getProvider(), applied))
        .isPresent();
  }

  private void disconnectSocket(UUID userId, SocketIoSocket socket) {
    try {
      forgetSocket(socket.getId());
      Map<String, SocketIoSocket> sockets = activityFeedEndpoints.get(userId);
      if (sockets != null) {
        sockets.remove(socket.getId());
      }
      socket.disconnect(true);
    } catch (RuntimeException e) {
      LOG.warn("Failed to disconnect socket {} for user {}", socket.getId(), userId, e);
    }
  }

  private void forgetSocket(String socketId) {
    socketSessionIds.remove(socketId);
    socketSessionValidatedAt.remove(socketId);
    socketTokenExpiries.forget(socketId);
  }

  public void sendToManyWithString(
      List<EntityRelationshipRecord> receivers, String event, String message) {
    receivers.forEach(e -> sendToOne(e.getId(), event, message));
  }

  public static class WebSocketManagerBuilder {
    private WebSocketManagerBuilder() {}

    /** No provider is applied: a socket is never closed for its provider at registration or sweep. */
    public static void build(EngineIoServerOptions eiOptions) {
      build(eiOptions, () -> null);
    }

    /** Judged against {@code appliedProvider}; no user is treated as gone, no peer is told. */
    public static void build(
        EngineIoServerOptions eiOptions, Supplier<AuthProvider> appliedProvider) {
      build(eiOptions, PushFeedSocketPolicy.validatingUnder(appliedProvider));
    }

    public static void build(EngineIoServerOptions eiOptions, PushFeedSocketPolicy policy) {
      instance = new WebSocketManager(eiOptions, policy);
    }
  }

  private record SweepPass(
      SessionService sessionService, Instant now, long intervalMillis, AuthProvider applied) {}
}
