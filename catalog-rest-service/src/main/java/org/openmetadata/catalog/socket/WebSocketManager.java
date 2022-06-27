package org.openmetadata.catalog.socket;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoNamespace;
import io.socket.socketio.server.SocketIoServer;
import io.socket.socketio.server.SocketIoSocket;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebSocketManager {
  private static final Logger LOG = LoggerFactory.getLogger(WebSocketManager.class);
  private static WebSocketManager INSTANCE;
  private final EngineIoServer mEngineIoServer;
  private final SocketIoServer mSocketIoServer;
  public static final String feedBroadcastChannel = "activityFeed";
  public static final String taskBroadcastChannel = "taskChannel";

  private final Map<UUID, SocketIoSocket> activityFeedEndpoints = new ConcurrentHashMap<>();

  private WebSocketManager(EngineIoServerOptions eiOptions) {
    mEngineIoServer = new EngineIoServer(eiOptions);
    mSocketIoServer = new SocketIoServer(mEngineIoServer);
    intilizateHandlers();
  }

  private void intilizateHandlers() {
    SocketIoNamespace ns = mSocketIoServer.namespace("/");
    // On Connection
    ns.on(
        "connection",
        args -> {
          SocketIoSocket socket = (SocketIoSocket) args[0];
          String userId = socket.getInitialHeaders().get("UserId").get(0);
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
                      "Client :"
                          + userId
                          + "with Remote Address :"
                          + socket.getInitialHeaders().get("RemoteAddress")
                          + " disconnected.");
                  activityFeedEndpoints.remove(UUID.fromString(userId));
                });
            activityFeedEndpoints.put(UUID.fromString(userId), socket);
          }
        });
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

  public Map<UUID, SocketIoSocket> getActivityFeedEndpoints() {
    return activityFeedEndpoints;
  }

  public void broadCastMessageToAll(String event, String message) {
    activityFeedEndpoints.forEach((key, value) -> value.send(event, message));
  }

  public void sendToOne(UUID receiver, String event, String message) {
    if (activityFeedEndpoints.containsKey(receiver)) {
      activityFeedEndpoints.get(receiver).send(event, message);
    }
  }

  public void sendToManyWithUUID(List<UUID> receivers, String event, String message) {
    receivers
        .forEach(
            (e) -> {
              if (activityFeedEndpoints.containsKey(e)) {
                activityFeedEndpoints.get(e).send(event, message);
              }
            });
  }

  public void sendToManyWithString(List<String> receivers, String event, String message) {
    receivers
        .forEach(
            (e) -> {
              UUID key = UUID.fromString(e);
              if (activityFeedEndpoints.containsKey(key)) {
                activityFeedEndpoints.get(key).send(event, message);
              }
            });
  }

  public static class WebSocketManagerBuilder {
    public static void build(EngineIoServerOptions eiOptions) {
      INSTANCE = new WebSocketManager(eiOptions);
    }
  }
}
