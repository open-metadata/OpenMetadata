package org.openmetadata.catalog.socket;

import io.socket.engineio.server.Emitter;
import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoNamespace;
import io.socket.socketio.server.SocketIoServer;
import io.socket.socketio.server.SocketIoSocket;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebSocketManager {
  private static final Logger LOG = LoggerFactory.getLogger(WebSocketManager.class);
  private static WebSocketManager INSTANCE;
  private final EngineIoServer mEngineIoServer;
  private final SocketIoServer mSocketIoServer;
  private final String feedBroadcastChannel = "activityFeed";
  private final Map<String, SocketIoSocket> activityFeedEndpoints = new ConcurrentHashMap<>();

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
              LOG.info(
                  "Client :"
                      + socket.getId()
                      + "with Remote Address :"
                      + socket.getInitialHeaders().get("RemoteAddress")
                      + "connected.");
              activityFeedEndpoints.put(socket.getId(), socket);
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

  public Map<String, SocketIoSocket> getActivityFeedEndpoints() {
    return activityFeedEndpoints;
  }

  public void broadCastMessageToClients(String message) {
    for (Map.Entry<String, SocketIoSocket> endpoints : activityFeedEndpoints.entrySet()) {
      endpoints.getValue().send(feedBroadcastChannel, message);
    }
  }

  public static class WebSocketManagerBuilder {
    public static void build(EngineIoServerOptions eiOptions) {
      INSTANCE = new WebSocketManager(eiOptions);
    }
  }
}
