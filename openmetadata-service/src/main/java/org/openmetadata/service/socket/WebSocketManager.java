package org.openmetadata.service.socket;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.USER;

import io.socket.engineio.server.EngineIoServer;
import io.socket.engineio.server.EngineIoServerOptions;
import io.socket.socketio.server.SocketIoNamespace;
import io.socket.socketio.server.SocketIoServer;
import io.socket.socketio.server.SocketIoSocket;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;

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
  public static final String MENTION_CHANNEL = "mentionChannel";
  public static final String ANNOUNCEMENT_CHANNEL = "announcementChannel";
  public static final String CSV_EXPORT_CHANNEL = "csvExportChannel";
  public static final String CSV_IMPORT_CHANNEL = "csvImportChannel";

  public static final String BULK_ASSETS_CHANNEL = "bulkAssetsChannel";

  public static final String DELETE_ENTITY_CHANNEL = "deleteEntityChannel";
  public static final String MOVE_GLOSSARY_TERM_CHANNEL = "moveGlossaryTermChannel";
  public static final String RDF_INDEX_JOB_BROADCAST_CHANNEL = "rdfIndexJobStatus";
  public static final String CHART_DATA_STREAM_CHANNEL = "chartDataStream";

  @Getter
  private final Map<UUID, Map<String, SocketIoSocket>> activityFeedEndpoints =
      new ConcurrentHashMap<>();

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
          String userId =
              userIdHeaders.isEmpty()
                  ? socket.getInitialQuery().get("userId")
                  : userIdHeaders.get(0);

          if (userId != null && !userId.equals("")) {
            LOG.info(
                "Client : {} with Remote Address:{} connected {} ",
                userId,
                remoteAddress,
                initialHeaders);

            // On Socket Disconnect
            socket.on(
                "disconnect",
                args1 -> {
                  LOG.info(
                      "Client from: {} with Remote Address:{} disconnected.",
                      userId,
                      remoteAddress);
                  UUID id = UUID.fromString(userId);
                  Map<String, SocketIoSocket> allUserConnection = activityFeedEndpoints.get(id);
                  allUserConnection.remove(socket.getId());
                  activityFeedEndpoints.put(id, allUserConnection);
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
            Map<String, SocketIoSocket> userSocketConnections;
            userSocketConnections =
                activityFeedEndpoints.containsKey(id)
                    ? activityFeedEndpoints.get(id)
                    : new HashMap<>();
            userSocketConnections.put(socket.getId(), socket);
            activityFeedEndpoints.put(id, userSocketConnections);
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
