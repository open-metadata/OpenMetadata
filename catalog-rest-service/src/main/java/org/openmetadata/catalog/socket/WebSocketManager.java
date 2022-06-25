package org.openmetadata.catalog.socket;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.openmetadata.catalog.entity.feed.Thread;
import org.openmetadata.catalog.type.EntityReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class WebSocketManager {
  private static final Logger LOG = LoggerFactory.getLogger(WebSocketManager.class);
  private static WebSocketManager INSTANCE;
  private final EngineIoServer mEngineIoServer;
  private final SocketIoServer mSocketIoServer;
  private final String feedBroadcastChannel = "activityFeed";
  private final String taskBroadcastChannel = "taskChannel";
  private final ObjectMapper mapper;

  private final Map<UUID, SocketIoSocket> activityFeedEndpoints = new ConcurrentHashMap<>();

  private WebSocketManager(EngineIoServerOptions eiOptions) {
    mEngineIoServer = new EngineIoServer(eiOptions);
    mSocketIoServer = new SocketIoServer(mEngineIoServer);
    mapper = new ObjectMapper();
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

  public void broadCastMessageToClients(Thread thread) throws JsonProcessingException {
    String jsonThread = mapper.writeValueAsString(thread);
    activityFeedEndpoints.forEach((key, value) -> value.send(feedBroadcastChannel, jsonThread));
  }

  public void handleWebSocket(Thread thread) throws JsonProcessingException {
    String jsonThread = mapper.writeValueAsString(thread);
    switch (thread.getType()) {
      case Task:
        List<EntityReference> assignees = thread.getTask().getAssignees();
        assignees
            .forEach(
                (e) -> {
                  if (activityFeedEndpoints.containsKey(e.getId())) {
                    activityFeedEndpoints.get(e.getId()).send(taskBroadcastChannel, jsonThread);
                  }
                });
        return;
      case Conversation:
        broadCastMessageToClients(thread);
        return;
      case Announcement:
    }
  }

  public static class WebSocketManagerBuilder {
    public static void build(EngineIoServerOptions eiOptions) {
      INSTANCE = new WebSocketManager(eiOptions);
    }
  }
}
