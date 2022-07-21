package org.openmetadata.catalog.socket;

import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoNamespace;
import io.socket.socketio.server.SocketIoServer;
import io.socket.socketio.server.SocketIoSocket;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.openmetadata.catalog.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebSocketManager {
  private static final Logger LOG = LoggerFactory.getLogger(WebSocketManager.class);
  private static WebSocketManager INSTANCE;
  private final EngineIoServer mEngineIoServer;
  private final SocketIoServer mSocketIoServer;
  public static final String feedBroadcastChannel = "activityFeed";
  public static final String taskBroadcastChannel = "taskChannel";
  public static final String mentionChannel = "mentionChannel";
  private final Map<UUID, Map<String, SocketIoSocket>> activityFeedEndpoints = new ConcurrentHashMap<>();

  private WebSocketManager(EngineIoServerOptions eiOptions) {
    mEngineIoServer = new EngineIoServer(eiOptions);
    mSocketIoServer = new SocketIoServer(mEngineIoServer);
    initializeHandlers();
  }

  private void initializeHandlers() {
    SocketIoNamespace ns = mSocketIoServer.namespace("/");
    // On Connection
    ns.on(
        "connection",
        args -> {
          SocketIoSocket socket = (SocketIoSocket) args[0];
          final String userId;
          String tempId;
          try {
            tempId = socket.getInitialHeaders().get("UserId").get(0);
          } catch (Exception ex) {
            tempId = socket.getInitialQuery().get("userId");
          }
          userId = tempId;

          if (userId != null && !userId.equals("")) {
            LOG.info(
                "Client :"
                    + userId
                    + "with Remote Address :"
                    + socket.getInitialHeaders().get("RemoteAddress")
                    + "connected."
                    + socket.getInitialQuery());

            // On Socket Disconnect
            socket.on(
                "disconnect",
                args1 -> {
                  LOG.info(
                      "Client from:"
                          + userId
                          + "with Remote Address :"
                          + socket.getInitialHeaders().get("RemoteAddress")
                          + " disconnected.");
                  UUID id = UUID.fromString(userId);
                  Map<String, SocketIoSocket> allUserConnection = activityFeedEndpoints.get(id);
                  allUserConnection.remove(socket.getId());
                  activityFeedEndpoints.put(id, allUserConnection);
                });
            socket.on(
                "connect_error",
                args1 ->
                    LOG.error(
                        "Connection ERROR for user:"
                            + userId
                            + "with Remote Address :"
                            + socket.getInitialHeaders().get("RemoteAddress")
                            + " disconnected."));
            socket.on(
                "connect_failed",
                args1 ->
                    LOG.error(
                        "Connection failed ERROR for user:"
                            + userId
                            + "with Remote Address :"
                            + socket.getInitialHeaders().get("RemoteAddress")
                            + " disconnected."));

            UUID id = UUID.fromString(userId);
            Map<String, SocketIoSocket> userSocketConnections;
            userSocketConnections =
                activityFeedEndpoints.containsKey(id) ? activityFeedEndpoints.get(id) : new HashMap<>();
            userSocketConnections.put(socket.getId(), socket);
            activityFeedEndpoints.put(id, userSocketConnections);
          }
        });
    ns.on("error", args -> LOG.error("Connection error on the server"));
  }

  public static WebSocketManager getInstance() {
    return INSTANCE;
  }

  public SocketIoServer getSocketIoServer() {
    return mSocketIoServer;
  }

  public EngineIoServer getEngineIoServer() {
    return mEngineIoServer;
  }

  public Map<UUID, Map<String, SocketIoSocket>> getActivityFeedEndpoints() {
    return activityFeedEndpoints;
  }

  public void broadCastMessageToAll(String event, String message) {
    activityFeedEndpoints.forEach((key, value) -> value.forEach((key1, value1) -> value1.send(event, message)));
  }

  public void sendToOne(UUID receiver, String event, String message) {
    if (activityFeedEndpoints.containsKey(receiver)) {
      activityFeedEndpoints.get(receiver).forEach((key, value) -> value.send(event, message));
    }
  }

  public void sendToManyWithUUID(List<UUID> receivers, String event, String message) {
    receivers.forEach(e -> sendToOne(e, event, message));
  }

  public void sendToManyWithString(List<EntityRelationshipRecord> receivers, String event, String message) {
    receivers.forEach(e -> sendToOne(e.getId(), event, message));
  }

  public static class WebSocketManagerBuilder {
    public static void build(EngineIoServerOptions eiOptions) {
      INSTANCE = new WebSocketManager(eiOptions);
    }
  }
}
